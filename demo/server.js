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
      + "CREATE TABLE data (transaction_hash TEXT PRIMARY KEY, text TEXT);"
      + "CREATE INDEX index_address ON model(address);";
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

  // Health
  app.get('/api/health', (req, res) => {
    res.send({ healthy: true });
  })

  // Get all models.
  app.get('/api/models', (req, res) => {
    const { afterAddress, limit } = req.query
    const getStmt = db.prepare('SELECT * FROM model WHERE address > $afterAddress LIMIT $limit;',
      {
        $afterAddress: afterAddress || '',
        $limit: limit == null ? 10 : limit,
      })
    const models = []
    while (getStmt.step()) {
      const model = getStmt.get()
      models.push({
        id: model[0],
        name: model[1],
        address: model[2],
        description: model[3],
        modelType: model[4],
        encoder: model[5],
        accuracy: model[6]
      });
    }
    getStmt.free()

    let lastAddress = ''
    if (models.length > 0) {
      lastAddress = models[models.length - 1].address
    }

    const remainingCountStmt = db.prepare('SELECT COUNT(id) FROM model WHERE address > $afterAddress;',
      {
        $afterAddress: lastAddress,
      })
    remainingCountStmt.step()
    const remaining = remainingCountStmt.get()[0]
    remainingCountStmt.free()
    res.send({ models, remaining })
  })

  // Get model with specific ID.
  app.get('/api/model', (req, res) => {
    const { modelId, address } = req.query;
    const getModelStmt = db.prepare("SELECT * FROM model WHERE id == $modelId OR address == $address LIMIT 1;");
    const model = getModelStmt.getAsObject({ $modelId: modelId, $address: address });
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
      data.originalData.text,
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
    const result = getTextStmt.getAsObject({ $transactionHash: req.params.transactionHash });
    getTextStmt.free();
    const { text } = result;
    res.send({ originalData: { text } });
  });

  app.listen(port, () => console.log(`Listening on port ${port}`));
});
