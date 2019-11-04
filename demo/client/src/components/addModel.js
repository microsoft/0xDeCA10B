import getWeb3 from "@drizzle-utils/get-web3";
import { Container, InputLabel, MenuItem, Select } from '@material-ui/core';
import Button from '@material-ui/core/Button';
import Grid from '@material-ui/core/Grid';
import Paper from '@material-ui/core/Paper';
import { withStyles } from '@material-ui/core/styles';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import axios from 'axios';
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

const styles = theme => ({
  root: {
    ...theme.mixins.gutters(),
    paddingTop: theme.spacing(2),
    paddingBottom: theme.spacing(2),
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
    marginTop: '20px'
  },
  selectorLabel: {
    marginTop: 8,
  },
  selector: {
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
  }
});

class AddModel extends React.Component {

  constructor(props) {
    super(props);
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
      }
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
    try {
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

  saveAddress(key, address) {
    this.setState({ deploymentInfo: update(this.state.deploymentInfo, { [key]: { address: { $set: address } } }) });
  }
  saveTransactionHash(key, transactionHash) {
    this.setState({ deploymentInfo: update(this.state.deploymentInfo, { [key]: { transactionHash: { $set: transactionHash } } }) });
  }

  handleInputChange(event) {
    const target = event.target;
    const value = target.type === "checkbox" ? target.checked : target.value;
    const name = target.name;
    this.setState({
      [name]: value
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
            </div>
          </form>
          {/* TODO Add table with transaction hashes and addresses. */}
          <Button className={this.classes.button} variant="outlined" color="primary" onClick={this.save}
            disabled={this.state.deploymentInfo.address !== undefined}
          >
            Save
          </Button>
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
        <TextField name="ownerClaimWaitTimeS" label="Owner claim wait time (seconds)"
          className={this.classes.numberTextField}
          value={this.state.ownerClaimWaitTimeS}
          type="number"
          margin="normal"
          onChange={this.handleInputChange} />
      </Grid>
      <Grid item xs={12} sm={6}>
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
    const { name, description, modelType, encoder } = this.state;
    const modelInfo = {
      name, description, modelType, encoder,
    };
    this.web3.eth.getAccounts(async (err, accounts) => {
      if (err) {
        throw err;
      }
      const account = accounts[0];

      const [model, incentiveMechanism, dataHandler] = await Promise.all([
        this.deployDataHandler(account),
        this.deployIncentiveMechanism(account),
        this.deployModel(account),
      ]);

      const mainContract = await this.deployMainEntryPoint(account, dataHandler, incentiveMechanism, model);

      modelInfo.address = mainContract.options.address;

      // Save to the database.
      axios.post('/api/models', modelInfo).then(() => {
        this.notify("Saved", { variant: 'success' });
        // TODO Redirect.
      }).catch(err => {
        console.error(err);
        console.error(err.response.data.message);
      });
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
            break;
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

    return new Promise((resolve, reject) => {
      const Contract = this.modelTypes[model.type];
      const contract = new this.web3.eth.Contract(Contract.abi, {
        from: account,
      });
      contract.deploy({
        data: Contract.bytecode,
        arguments: [classifications, weights.slice(0, weightChunkSize), intercept, learningRate],
      }).send({
        // Block gas limit by most miners as of October 2019.
        gas: 9E6,
      }).on('transactionHash', transactionHash => {
        this.dismissNotification(pleaseAcceptKey);
        this.notify(`Submitted the model with transaction hash: ${transactionHash}. Please wait for a deployment confirmation.`);
        this.saveTransactionHash('model', transactionHash);
      }).on('receipt', async receipt => {
        this.notify(`The model contract has been deployed to ${receipt.contractAddress}`, { variant: 'success' });
        contract.options.address = receipt.contractAddress;

        // Add remaining weights.
        for (let i = weightChunkSize; i < weights.length; i += weightChunkSize) {
          const notification = this.notify("Please accept the prompt to upload classifier weights")
          // TODO Use the event based way to send transactions so that others can be queued.
          if (model.type === 'dense perceptron') {
            await contract.methods.initializeWeights(weights.slice(i, i + weightChunkSize)).send();
          } else if (model.type === 'sparse perceptron') {
            await contract.methods.initializeWeights(i, weights.slice(i, i + weightChunkSize)).send();
          } else {
            throw new Error(`Unrecognized model type: "${model.type}"`);
          }
          this.dismissNotification(notification);
        }
        if (featureIndices !== undefined) {
          // Add feature indices to use.
          for (let i = 0; i < featureIndices.length; i += weightChunkSize) {
            const notification = this.notify("Please accept the prompt to upload the feature indices")
            await contract.methods.addFeatureIndices(featureIndices.slice(i, i + weightChunkSize)).send();
            this.dismissNotification(notification);
          }
        }

        this.saveAddress('model', receipt.contractAddress);
        resolve(contract);
      }).on('error', err => {
        this.dismissNotification(pleaseAcceptKey);
        console.error(err);
        this.notify("Error deploying the model", { variant: 'error' });
        reject(err);
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
        result = new Promise((resolve, reject) => {
          const stakeableContract = new this.web3.eth.Contract(Stakeable64.abi, {
            from: account,
          });
          stakeableContract.deploy({
            data: Stakeable64.bytecode,
            arguments: [refundTimeWaitTimeS, ownerClaimWaitTimeS, anyAddressClaimWaitTimeS, costWeight],
          }).send({
          }).on('transactionHash', transactionHash => {
            this.dismissNotification(pleaseAcceptKey);
            this.notify(`Submitted the incentive mechanism with transaction hash: ${transactionHash}. Please wait for a deployment confirmation.`);
            this.saveTransactionHash('dataHandler', transactionHash);
          }).on('receipt', receipt => {
            this.notify(`The incentive mechanism contract has been deployed to ${receipt.contractAddress}`, { variant: 'success' });
            stakeableContract.options.address = receipt.contractAddress;
            this.saveAddress('dataHandler', receipt.contractAddress);
            resolve(stakeableContract);
          }).on('error', err => {
            this.dismissNotification(pleaseAcceptKey);
            console.error(err);
            this.notify("Error deploying the incentive mechanism", { variant: 'error' });
            reject(err);
          });
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
    return new Promise((resolve, reject) => {
      dataHandlerContract.deploy({
        data: DataHandler64.bytecode,
      }).send({
      }).on('transactionHash', transactionHash => {
        this.dismissNotification(pleaseAcceptKey);
        this.notify(`Submitted the data handler with transaction hash: ${transactionHash}. Please wait for a deployment confirmation.`);
        this.saveTransactionHash('dataHandler', transactionHash);
      }).on('receipt', receipt => {
        this.notify(`The data handler contract has been deployed to ${receipt.contractAddress}`, { variant: 'success' });
        dataHandlerContract.options.address = receipt.contractAddress;
        this.saveAddress('dataHandler', receipt.contractAddress);
        resolve(dataHandlerContract);
      }).on('error', err => {
        this.dismissNotification(pleaseAcceptKey);
        console.error(err);
        this.notify("Error deploying the data handler", { variant: 'error' });
        reject(err);
      });
    });
  }

  async deployMainEntryPoint(account, dataHandler, incentiveMechanism, model) {
    const pleaseAcceptKey = this.notify("Please accept the prompt to deploy the main entry point contact");
    return new Promise((resolve, reject) => {
      const collaborativeTrainer64Contract = new this.web3.eth.Contract(CollaborativeTrainer64.abi, {
        from: account,
      });
      collaborativeTrainer64Contract.deploy({
        data: CollaborativeTrainer64.bytecode,
        arguments: [dataHandler.options.address, incentiveMechanism.options.address, model.options.address],
      }).send({
      }).on('transactionHash', transactionHash => {
        this.dismissNotification(pleaseAcceptKey);
        this.notify(`Submitted the main entry point with transaction hash: ${transactionHash}. Please wait for a deployment confirmation.`);
        this.saveTransactionHash('main', transactionHash);
      }).on('receipt', receipt => {
        collaborativeTrainer64Contract.options.address = receipt.contractAddress;
        this.notify(`The main entry point contract has been deployed to ${receipt.contractAddress}`, { variant: 'success' });
        this.notify(`Please accept the next 3 transactions to transfer ownership of the components to the main entry point contract`);
        this.saveAddress('main', receipt.contractAddress);
        return Promise.all([
          dataHandler.methods.transferOwnership(receipt.contractAddress).send(),
          incentiveMechanism.methods.transferOwnership(receipt.contractAddress).send(),
          model.methods.transferOwnership(receipt.contractAddress).send(),
        ]).then(_ => {
          resolve(collaborativeTrainer64Contract);
        });
      }).on('error', err => {
        this.dismissNotification(pleaseAcceptKey);
        console.error(err);
        this.notify(`Error deploying the main entry point contract`, { variant: 'error' });
        reject(err);
      });
    });
  }
}

AddModel.propTypes = {
  classes: PropTypes.object.isRequired,
};

export default withSnackbar(withStyles(styles)(AddModel));
