const express = require('express');
const fs = require('fs');
const initSqlJs = require('sql.js');
const app = express();
const port = process.env.PORT || 5387;
const bodyParser = require('body-parser');
const jsonParser = bodyParser.json();

const dbPath = 'db.sqlite';

initSqlJs().then(SQL => {
  let db;
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    console.log(`Loading DB from "${dbPath}".`);
    db = new SQL.Database(fileBuffer);
  } else {
    console.log("Creating a new DB.");
    db = new SQL.Database();
    sqlstr = "CREATE TABLE model (id INTEGER PRIMARY KEY, name TEXT, address TEXT, description TEXT, model_type TEXT, encoder TEXT, accuracy NUMBER);"
      + "CREATE TABLE data (transaction_hash TEXT PRIMARY KEY, text TEXT);";
    db.run(sqlstr);
  }

  // MODEL MANAGEMENT

  function isBodyValid(body) {
    return body && body.name && body.address;
  }

  function persistModel(model) {
    db.run('INSERT INTO model VALUES (NULL, ?, ?, ?, ?, ?, ?);', [
      model.name,
      model.address,
      model.description,
      model.modelType,
      model.encoder,
      model.accuracy,
    ]);
    fs.writeFileSync(dbPath, Buffer.from(db.export()));
  }

  function marshalResults(res) {
    if (!res[0]) {
      return null;
    }

    return res[0].values.map(v => ({
      'id': v[0],
      'name': v[1],
      'address': v[2],
      'description': v[3],
      'modelType': v[4],
      'encoder': v[5],
      'accuracy': v[6]
    }));
  }

  // Get all models.
  app.get('/api/models', (req, res) => {
    const results = db.exec("SELECT * FROM model");
    const models = marshalResults(results);
    res.send({ models });
  });

  // Get model with specific ID.
  app.get('/api/models/:modelId', (req, res) => {
    const getModelStmt = db.prepare("SELECT * FROM model WHERE id == $modelId LIMIT 1;");
    const model = getModelStmt.getAsObject({ $modelId: req.params.modelId });
    getModelStmt.free();
    model.modelType = model.model_type;
    delete model.model_type;
    res.send({ model });
  });

  // Insert a new model.
  app.post('/api/models', jsonParser, (req, res) => {
    const body = req.body;
    if (!isBodyValid(body)) {
      return res.status(400).send({ message: "The body is invalid." });
    }
    try {
      persistModel(body);
    } catch (err) {
      return res.status(400).send({ message: err.message || err });
    }
    return res.sendStatus(200);
  });

  // DATA MANAGEMENT
  function persistData(data) {
    db.run('INSERT INTO data VALUES (?, ?);', [
      data.transactionHash,
      data.originalData,
    ]);
    fs.writeFile(dbPath, Buffer.from(db.export()), () => { });
  }

  // Insert a training sample.
  app.post('/api/data', jsonParser, (req, res) => {
    const body = req.body
    persistData(body);
    return res.sendStatus(200);
  });

  // Get original training data.
  app.get('/api/data/:transactionHash', (req, res) => {
    const getTextStmt = db.prepare('SELECT text FROM data WHERE transaction_hash == $transactionHash LIMIT 1;');
    const textResult = getTextStmt.getAsObject({ $transactionHash: req.params.transactionHash });
    getTextStmt.free();
    const originalData = textResult.text;
    res.send({ originalData });
  });

  app.listen(port, () => console.log(`Listening on port ${port}`));
});
