import getWeb3 from "@drizzle-utils/get-web3";
import { Container, InputLabel, MenuItem, Select, Table, TableBody, TableCell, TableHead, TableRow } from '@material-ui/core';
import Button from '@material-ui/core/Button';
import Grid from '@material-ui/core/Grid';
import Paper from '@material-ui/core/Paper';
import { withStyles } from '@material-ui/core/styles';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import update from 'immutability-helper';
import { withSnackbar } from 'notistack';
import PropTypes from 'prop-types';
import React from 'react';
import Dropzone from 'react-dropzone';
import Web3 from "web3"; // Only required for custom/fallback provider option.
import CollaborativeTrainer64 from '../contracts/CollaborativeTrainer64.json';
import DataHandler64 from '../contracts/DataHandler64.json';
import DensePerceptron from '../contracts/DensePerceptron.json';
import SparsePerceptron from '../contracts/SparsePerceptron.json';
import Stakeable64 from '../contracts/Stakeable64.json';
import { convertToHex, convertToHexData } from '../float-utils';
import { DataStoreFactory } from '../storage/data-store-factory';
import { checkStorages, renderStorageSelector } from './storageSelector';

const styles = theme => ({
  root: {
    ...theme.mixins.gutters(),
    paddingTop: theme.spacing(2),
    paddingBottom: theme.spacing(2),
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  form: {
    display: 'flex',
    flex: 1,
    flexDirection: 'column'
  },
  input: {
    // display: 'none'
  },
  button: {
    marginTop: 20,
  },
  selectorLabel: {
    marginTop: 8,
  },
  selector: {
    paddingTop: theme.spacing(1),
    marginBottom: 8,
  },
  numberTextField: {
    // Some of the labels are long so we need long input boxes to show the entire label nicely.
    width: 300,
  },
  dropPaper: {
    ...theme.mixins.gutters(),
    paddingTop: theme.spacing(2),
    paddingBottom: theme.spacing(2),
  },
  table: {
    minWidth: 650,
    wordBreak: 'break-word',
  },
});

class AddModel extends React.Component {

  constructor(props) {
    super(props);

    // Default to local storage for storing original data.
    const storageType = localStorage.getItem('storageType') || 'local';
    const storageFactory = new DataStoreFactory();
    this.storages = {
      local: storageFactory.create('local'),
      service: storageFactory.create('service'),
    }

    this.state = {
      name: "",
      description: "",
      toFloat: 1E9,
      modelType: 'Classifier64',
      modelFileName: undefined,
      encoder: 'none',
      incentiveMechanism: 'Stakeable64',
      refundTimeWaitTimeS: 60,
      ownerClaimWaitTimeS: 120,
      anyAddressClaimWaitTimeS: 300,
      costWeight: 1E15,
      deploymentInfo: {
        dataHandler: {
          transactionHash: undefined,
          address: undefined,
        },
        incentiveMechanism: {
          transactionHash: undefined,
          address: undefined,
        },
        model: {
          transactionHash: undefined,
          address: undefined,
        },
        main: {
          transactionHash: undefined,
          address: undefined,
        },
      },
      storageType,
      permittedStorageTypes: [],
    };

    this.modelTypes = {
      'dense perceptron': DensePerceptron,
      'sparse perceptron': SparsePerceptron,
    };
    this.classes = props.classes;
    this.web3 = null;
    this.save = this.save.bind(this);
    this.handleInputChange = this.handleInputChange.bind(this);
    this.processUploadedModel = this.processUploadedModel.bind(this);
  }

  componentDidMount = async () => {
    checkStorages(this.storages).then(permittedStorageTypes => {
      this.setState({ permittedStorageTypes })
    })
    try {
      // Get rid of a warning about network refreshing.
      window.ethereum.autoRefreshOnNetworkChange = false;

      const fallbackProvider = new Web3.providers.HttpProvider("http://127.0.0.1:7545");
      this.web3 = await getWeb3({ fallbackProvider, requestPermission: true });
    } catch (error) {
      alert(`Failed to load web3, accounts, or contract. Check console for details.`);
      console.error(error);
    }
  }

  notify(...args) {
    return this.props.enqueueSnackbar(...args);
  }

  dismissNotification(...args) {
    return this.props.closeSnackbar(...args);
  }

  saveTransactionHash(key, transactionHash) {
    this.setState({ deploymentInfo: update(this.state.deploymentInfo, { [key]: { transactionHash: { $set: transactionHash } } }) });
  }

  saveAddress(key, address) {
    this.setState({ deploymentInfo: update(this.state.deploymentInfo, { [key]: { address: { $set: address } } }) });
  }

  handleInputChange(event) {
    const target = event.target;
    const value = target.type === "checkbox" ? target.checked : target.value;
    const name = target.name;
    this.setState({
      [name]: value
    }, _ => {
      if (name === 'storageType') {
        localStorage.setItem(name, value);
      }
    });
  }

  processUploadedModel(acceptedFiles) {
    if (acceptedFiles.length === 0 || acceptedFiles.length > 1) {
      alert("Please only provide one file.");
    }
    const reader = new FileReader();
    const file = acceptedFiles[0];
    reader.onabort = () => console.error("File reading was aborted.");
    reader.onerror = () => console.error("File reading has failed.");
    reader.onload = () => {
      const binaryStr = reader.result
      const model = JSON.parse(binaryStr);
      this.setState({ model, modelFileName: file.path });
    };
    reader.readAsBinaryString(file);
  }

  render() {
    return (
      <Container>
        <Paper className={this.classes.root} elevation={1}>
          <Typography variant="h5" component="h3">
            Add your model
          </Typography>
          <form className={this.classes.container} noValidate autoComplete="off">
            <div className={this.classes.form} >
              <TextField
                name="name"
                label="Name"
                className={this.classes.textField}
                margin="normal"
                onChange={this.handleInputChange}
              />
              <TextField
                name="description"
                label="Description"
                className={this.classes.textField}
                margin="normal"
                onChange={this.handleInputChange}
              />
              <InputLabel className={this.classes.selectorLabel} htmlFor="model-type">Model type</InputLabel>
              <Select className={this.classes.selector}
                onChange={this.handleInputChange}
                value={this.state.modelType}
                inputProps={{
                  name: 'modelType',
                }}
              >
                <MenuItem value={"Classifier64"}>Classifier64</MenuItem>
              </Select>
              <Dropzone onDrop={this.processUploadedModel}>
                {({ getRootProps, getInputProps }) => (
                  <Paper {...getRootProps()} className={this.classes.dropPaper}>
                    <input {...getInputProps()} />
                    <Typography component="p">
                      Drag and drop a model file here, or click to select a file
                      {this.state.modelFileName && ` (using ${this.state.modelFileName})`}
                    </Typography>
                  </Paper>
                )}
              </Dropzone>
              <InputLabel className={this.classes.selectorLabel} htmlFor="encoder">Encoder</InputLabel>
              <Select className={this.classes.selector}
                onChange={this.handleInputChange}
                value={this.state.encoder}
                inputProps={{
                  name: 'encoder',
                }}
              >
                <MenuItem value={"none"}>None</MenuItem>
                <MenuItem value={"IMDB vocab"}>IMDB vocab (for English text)</MenuItem>
                <MenuItem value={"universal sentence encoder"}>Universal Sentence Encoder (for English text)</MenuItem>
                <MenuItem value={"MobileNetv2"}>MobileNetv2 (for images)</MenuItem>
              </Select>
              <InputLabel className={this.classes.selectorLabel} htmlFor="incentiveMechanism">Incentive mechanism</InputLabel>
              <Select className={this.classes.selector}
                onChange={this.handleInputChange}
                value={this.state.incentiveMechanism}
                inputProps={{
                  name: 'incentiveMechanism',
                }}
              >
                {/* TODO <MenuItem value={"Points"}>Points</MenuItem> */}
                <MenuItem value={"Stakeable64"}>Stakeable64</MenuItem>
              </Select>
              {this.state.incentiveMechanism === "Stakeable64" &&
                this.renderStakeableOptions()
              }
              <div className={this.classes.selector}>
                {renderStorageSelector("where to store the supplied meta-data about this model like its address",
                  this.state.storageType, this.handleInputChange, this.state.permittedStorageTypes)}
              </div>
            </div>
          </form>
          <Button className={this.classes.button} variant="outlined" color="primary" onClick={this.save}
            disabled={this.state.deploymentInfo.main.address !== undefined
              || !(this.state.refundTimeWaitTimeS <= this.state.ownerClaimWaitTimeS)
              || !(this.state.ownerClaimWaitTimeS <= this.state.anyAddressClaimWaitTimeS)}
          >
            Save
          </Button>
        </Paper>
        <Paper className={this.classes.root} elevation={1}>
          <Table className={this.classes.table} aria-label="Deployment Information Table">
            <TableHead>
              <TableRow>
                <TableCell>Contract</TableCell>
                <TableCell>Transaction Hash</TableCell>
                <TableCell>Address</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell component="th">Data Handler</TableCell>
                <TableCell>{this.state.deploymentInfo.dataHandler.transactionHash}</TableCell>
                <TableCell>{this.state.deploymentInfo.dataHandler.address}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell component="th">Incentive Mechanism</TableCell>
                <TableCell>{this.state.deploymentInfo.incentiveMechanism.transactionHash}</TableCell>
                <TableCell>{this.state.deploymentInfo.incentiveMechanism.address}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell component="th">Model</TableCell>
                <TableCell>{this.state.deploymentInfo.model.transactionHash}</TableCell>
                <TableCell>{this.state.deploymentInfo.model.address}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell component="th">Main Entry Point</TableCell>
                <TableCell>{this.state.deploymentInfo.main.transactionHash}</TableCell>
                <TableCell>{this.state.deploymentInfo.main.address}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Paper>
      </Container>
    );
  }

  renderStakeableOptions() {
    return <Grid container spacing={2}>
      <Grid item xs={12} sm={6}>
        <TextField name="refundTimeWaitTimeS" label="Refund wait time (seconds)"
          className={this.classes.numberTextField}
          value={this.state.refundTimeWaitTimeS}
          type="number"
          margin="normal"
          onChange={this.handleInputChange} />
      </Grid>
      <Grid item xs={12} sm={6}>
        {/* TODO Show error if it is too low. */}
        <TextField name="ownerClaimWaitTimeS" label="Owner claim wait time (seconds)"
          className={this.classes.numberTextField}
          value={this.state.ownerClaimWaitTimeS}
          type="number"
          margin="normal"
          onChange={this.handleInputChange} />
      </Grid>
      <Grid item xs={12} sm={6}>
        {/* TODO Show error if it is too low. */}
        <TextField name="anyAddressClaimWaitTimeS" label="Any address claim wait time (seconds)"
          className={this.classes.numberTextField}
          value={this.state.anyAddressClaimWaitTimeS}
          type="number"
          margin="normal"
          onChange={this.handleInputChange} />
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField name="costWeight" label="Cost weight (in wei)"
          className={this.classes.numberTextField}
          value={this.state.costWeight}
          type="number"
          margin="normal"
          onChange={this.handleInputChange} />
      </Grid>
    </Grid>;
  }

  async save() {
    // TODO Keep track of contract addresses of whatever has been deployed so far so that the process can be recovered.
    const { name, description, model, modelType, encoder } = this.state;
    const modelInfo = {
      name, description, modelType, encoder,
    };

    // Validate
    if (!name) {
      this.notify("Please provide a name", { variant: 'error' });
      return;
    }
    if (modelType === undefined || model === undefined) {
      this.notify("You must select model type and provide a model file", { variant: 'error' });
      return;
    }

    this.web3.eth.getAccounts(async (err, accounts) => {
      if (err) {
        throw err;
      }
      const account = accounts[0];

      const [dataHandler, incentiveMechanism, model] = await Promise.all([
        this.deployDataHandler(account),
        this.deployIncentiveMechanism(account),
        this.deployModel(account),
      ]);

      const mainContract = await this.deployMainEntryPoint(account, dataHandler, incentiveMechanism, model);

      modelInfo.address = mainContract.options.address;


      if (this.state.storageType !== 'none') {
        // Save to a database.
        const storage = this.storages[this.state.storageType];
        storage.saveModelInformation(modelInfo).then(() => {
          this.notify("Saved", { variant: 'success' });
          // TODO Redirect.
        }).catch(err => {
          console.error(err);
          console.error(err.response.data.message);
        });
      }
    });
  }

  async deployModel(account) {
    const { model, modelType } = this.state;
    const pleaseAcceptKey = this.notify("Please accept the prompt to deploy the classifier");
    let result;

    switch (modelType) {
      case 'Classifier64':
        switch (model.type) {
          case 'nearest centroid classifier':
            // TODO Load the model from the file and set up deployment.
            this.dismissNotification(pleaseAcceptKey);
            throw new Error("Nearest centroid classifier is not supported yet.")
          // break;
          case 'dense perceptron':
          case 'sparse perceptron':
            result = this.deployPerceptron(pleaseAcceptKey, account);
            break;
          default:
            // Should not happen.
            this.dismissNotification(pleaseAcceptKey);
            throw new Error(`Unrecognized model type: "${model.type}"`);
        }
        break;
      default:
        // Should not happen.
        this.dismissNotification(pleaseAcceptKey);
        throw new Error(`Unrecognized model type: "${modelType}"`);
    }

    return result;
  }

  async deployPerceptron(pleaseAcceptKey, account) {
    const defaultPerceptronLearningRate = 0.5;
    const weightChunkSize = 250;

    const { model } = this.state;
    const { classifications, featureIndices } = model;
    const weights = convertToHexData(model.weights, this.web3, this.state.toFloat);
    const intercept = convertToHex(model.bias, this.web3, this.state.toFloat);
    const learningRate = convertToHex(model.learningRate || defaultPerceptronLearningRate, this.web3, this.state.toFloat);

    if (featureIndices !== undefined && featureIndices.length !== weights.length) {
      console.error("The number of features must match the number of weights.");
      this.notify("The number of features must match the number of weights", { variant: 'error' });
    }

    const Contract = this.modelTypes[model.type];
    const contract = new this.web3.eth.Contract(Contract.abi, {
      from: account,
    });
    return contract.deploy({
      data: Contract.bytecode,
      arguments: [classifications, weights.slice(0, weightChunkSize), intercept, learningRate],
    }).send({
      // Block gas limit by most miners as of October 2019.
      gas: 8.9E6,
    }).on('transactionHash', transactionHash => {
      this.dismissNotification(pleaseAcceptKey);
      this.notify(`Submitted the model with transaction hash: ${transactionHash}. Please wait for a deployment confirmation.`);
      this.saveTransactionHash('model', transactionHash);
    }).on('error', err => {
      this.dismissNotification(pleaseAcceptKey);
      console.error(err);
      this.notify("Error deploying the model", { variant: 'error' });
      throw err;
    }).then(async newContractInstance => {
      // Could create a batch but I was getting various errors when trying to do and could not find docs on what `execute` returns.
      const transactions = [];
      // Add remaining weights.
      for (let i = weightChunkSize; i < weights.length; i += weightChunkSize) {
        let transaction;
        if (model.type === 'dense perceptron') {
          transaction = newContractInstance.methods.initializeWeights(weights.slice(i, i + weightChunkSize));
        } else if (model.type === 'sparse perceptron') {
          transaction = newContractInstance.methods.initializeWeights(i, weights.slice(i, i + weightChunkSize));
        } else {
          throw new Error(`Unrecognized model type: "${model.type}"`);
        }
        transactions.push(new Promise((resolve, reject) => {
          // Subtract 1 from the count because the first chunk has already been uploaded.
          const notification = this.notify(`Please accept the prompt to upload classifier 
          weights [${i},${i + weightChunkSize}) (${i / weightChunkSize}/${Math.ceil(weights.length / weightChunkSize) - 1})`);
          transaction.send().on('transactionHash', _ => {
            this.dismissNotification(notification);
          }).on('error', err => {
            this.dismissNotification(notification);
            console.error(err);
            this.notify(`Error setting weights classifier weights [${i},${i + weightChunkSize})`, { variant: 'error' });
            reject(err);
          }).then(resolve);
        }));
      }
      if (featureIndices !== undefined) {
        // Add feature indices to use.
        for (let i = 0; i < featureIndices.length; i += weightChunkSize) {
          transactions.push(new Promise((resolve, reject) => {
            const notification = this.notify(`Please accept the prompt to upload the feature indices [${i},${i + weightChunkSize})`);
            newContractInstance.methods.addFeatureIndices(featureIndices.slice(i, i + weightChunkSize)).send()
              .on('transactionHash', _ => {
                this.dismissNotification(notification);
              }).on('error', err => {
                this.dismissNotification(notification);
                console.error(err);
                this.notify(`Error setting feature indices for [${i},${i + weightChunkSize})`, { variant: 'error' });
                reject(err);
              }).then(resolve);
          }));
        }
      }

      return Promise.all(transactions).then(_ => {
        this.notify(`The model contract has been deployed to ${newContractInstance.options.address}`, { variant: 'success' });
        this.saveAddress('model', newContractInstance.options.address);
        return newContractInstance;
      });
    });
  }

  async deployIncentiveMechanism(account) {
    let result;
    const { refundTimeWaitTimeS, ownerClaimWaitTimeS, anyAddressClaimWaitTimeS, costWeight, incentiveMechanism } = this.state;
    const pleaseAcceptKey = this.notify("Please accept to deploy the incentive mechanism contract");
    switch (incentiveMechanism) {
      case 'Points':
        // TODO
        break;
      case 'Stakeable64':
        const stakeableContract = new this.web3.eth.Contract(Stakeable64.abi, {
          from: account,
        });
        result = stakeableContract.deploy({
          data: Stakeable64.bytecode,
          arguments: [refundTimeWaitTimeS, ownerClaimWaitTimeS, anyAddressClaimWaitTimeS, costWeight],
        }).send({
        }).on('transactionHash', transactionHash => {
          this.dismissNotification(pleaseAcceptKey);
          this.notify(`Submitted the incentive mechanism with transaction hash: ${transactionHash}. Please wait for a deployment confirmation.`);
          this.saveTransactionHash('incentiveMechanism', transactionHash);
        }).on('receipt', receipt => {
          this.notify(`The incentive mechanism contract has been deployed to ${receipt.contractAddress}`, { variant: 'success' });
          this.saveAddress('incentiveMechanism', receipt.contractAddress);
        }).on('error', err => {
          this.dismissNotification(pleaseAcceptKey);
          console.error(err);
          this.notify("Error deploying the incentive mechanism", { variant: 'error' });
          throw err;
        });
        break;
      default:
        // Should not happen.
        this.dismissNotification(pleaseAcceptKey);
        throw new Error(`Unrecognized incentive mechanism: "${incentiveMechanism}"`);
    }

    return result;
  }

  async deployDataHandler(account) {
    const pleaseAcceptKey = this.notify("Please accept the prompt to deploy the data handler");
    const dataHandlerContract = new this.web3.eth.Contract(DataHandler64.abi, {
      from: account,
    });
    return dataHandlerContract.deploy({
      data: DataHandler64.bytecode,
    }).send({
    }).on('transactionHash', transactionHash => {
      this.dismissNotification(pleaseAcceptKey);
      this.notify(`Submitted the data handler with transaction hash: ${transactionHash}. Please wait for a deployment confirmation.`);
      this.saveTransactionHash('dataHandler', transactionHash);
    }).on('receipt', receipt => {
      this.notify(`The data handler contract has been deployed to ${receipt.contractAddress}`, { variant: 'success' });
      this.saveAddress('dataHandler', receipt.contractAddress);
    }).on('error', err => {
      this.dismissNotification(pleaseAcceptKey);
      console.error(err);
      this.notify("Error deploying the data handler", { variant: 'error' });
      throw err;
    });
  }

  async deployMainEntryPoint(account, dataHandler, incentiveMechanism, model) {
    const pleaseAcceptKey = this.notify("Please accept the prompt to deploy the main entry point contact");
    const collaborativeTrainer64Contract = new this.web3.eth.Contract(CollaborativeTrainer64.abi, {
      from: account,
    });
    return collaborativeTrainer64Contract.deploy({
      data: CollaborativeTrainer64.bytecode,
      arguments: [dataHandler.options.address, incentiveMechanism.options.address, model.options.address],
    }).send({
    }).on('transactionHash', transactionHash => {
      this.dismissNotification(pleaseAcceptKey);
      this.notify(`Submitted the main entry point with transaction hash: ${transactionHash}. Please wait for a deployment confirmation.`);
      this.saveTransactionHash('main', transactionHash);
    }).on('receipt', receipt => {
      this.notify(`The main entry point contract has been deployed to ${receipt.contractAddress}`, { variant: 'success' });
      this.saveAddress('main', receipt.contractAddress);
    }).on('error', err => {
      this.dismissNotification(pleaseAcceptKey);
      console.error(err);
      this.notify(`Error deploying the main entry point contract`, { variant: 'error' });
      throw err;
    }).then(newContractInstance => {
      this.notify(`Please accept the next 3 transactions to transfer ownership of the components to the main entry point contract`);
      return Promise.all([
        dataHandler.methods.transferOwnership(newContractInstance.options.address).send(),
        incentiveMechanism.methods.transferOwnership(newContractInstance.options.address).send(),
        model.methods.transferOwnership(newContractInstance.options.address).send(),
      ]).then(_ => {
        return newContractInstance;
      });
    });
  }
}

AddModel.propTypes = {
  classes: PropTypes.object.isRequired,
};

export default withSnackbar(withStyles(styles)(AddModel));
