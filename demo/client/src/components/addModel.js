import getWeb3 from "@drizzle-utils/get-web3";
import { Container, InputLabel, MenuItem, Select } from '@material-ui/core';
import Button from '@material-ui/core/Button';
import Grid from '@material-ui/core/Grid';
import Paper from '@material-ui/core/Paper';
import { withStyles } from '@material-ui/core/styles';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import axios from 'axios';
import PropTypes from 'prop-types';
import React from 'react';
import Dropzone from 'react-dropzone';
import Web3 from "web3"; // Only required for custom/fallback provider option.
import CollaborativeTrainer64 from '../contracts/CollaborativeTrainer64.json';
import DataHandler64 from '../contracts/DataHandler64.json';
import Stakeable64 from '../contracts/Stakeable64.json';
import { withSnackbar } from 'notistack';

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
      json: null,
      name: "",
      description: "",
      modelType: 'Classifier64',
      encoder: 'none',
      incentiveMechanism: 'Stakeable64',
      refundTimeWaitTimeS: 60,
      ownerClaimWaitTimeS: 120,
      anyAddressClaimWaitTimeS: 300,
      costWeight: 1E15
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
      this.setState({ model });
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
          <Button className={this.classes.button} variant="outlined" color="primary" onClick={this.save}>Save</Button>
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
        this.deployModel(account),
        this.deployIncentiveMechanism(account),
        this.deployDataHandler(account),
      ]);


      console.log(dataHandler);
      // FIXME Remove this check once the methods are implemented to deploy the other components.
      if (model === undefined || incentiveMechanism === undefined) {
        this.notify("No model or IM yet.", { variant: 'error' });
        return;
      }

      const mainContract = await this.deployMainEntryPoint(account, dataHandler, incentiveMechanism, model);

      modelInfo.address = mainContract.contractAddress;

      // Save to the database.
      axios.post('/api/models', modelInfo).then(() => {
        console.log("Saved");
      }).catch(err => {
        console.error(err);
        console.error(err.response.data.message);
      });
    });
  }

  async deployModel(account) {
    const { modelType, encoder } = this.state;
    const pleaseAcceptKey = this.notify("Please accept to deploy the classifier");
    let result;
    switch (modelType) {
      case 'Classifier64':
        // TODO Load the model from the file and set up deployment.
        // TODO Deploy.
        break;
      default:
        // Should not happen.
        this.dismissNotification(pleaseAcceptKey);
        throw new Error(`Unrecognized model type: "${modelType}"`);
    }

    // this.notify(`The model contract has been deployed to ${result.options.address}`);
    return result;
  }

  async deployIncentiveMechanism(account) {
    let result;
    const pleaseAcceptKey = this.notify("Please accept to deploy the incentive mechanism contract");
    switch (this.state.incentiveMechanism) {
      case 'Points':
        // TODO
        break;
      case 'Stakeable64':
        // TODO

        break;
      default:
        break;
    }

    // this.notify(`The incentive mechanism contract has been deployed to ${result.options.address}`);
    return result;
  }

  async deployDataHandler(account) {
    const pleaseAcceptKey = this.notify("Please accept the prompt to deploy the data handler");
    const DataHandlerContract = new this.web3.eth.Contract(DataHandler64.abi);
    return new Promise((resolve, reject) => {
      DataHandlerContract.deploy({
        data: DataHandler64.bytecode,
      }).send({
        from: account,
      }).on('transactionHash', transactionHash => {
        this.dismissNotification(pleaseAcceptKey);
        this.notify(`Submitted the data handler with transaction hash: ${transactionHash}. Please wait for a deployment confirmation.`);
      }).on('receipt', dataHandler => {
        this.notify(`The data handler contract has been deployed to ${dataHandler.contractAddress}`, { variant: 'success' });
        resolve(dataHandler);
      }).on('error', err => {
        this.dismissNotification(pleaseAcceptKey);
        console.error(err);
        this.notify(`Error deploying the data handler`, { variant: 'error' });
        reject(err);
      });
    });
  }

  async deployMainEntryPoint(account, dataHandler, incentiveMechanism, model) {
    const pleaseAcceptKey = this.notify("Please accept the prompt to deploy the main entry point contact");
    const CollaborativeTrainer64Contract = new this.web3.eth.Contract(CollaborativeTrainer64.abi);
    return new Promise((resolve, reject) => {
      CollaborativeTrainer64Contract.deploy({
        data: CollaborativeTrainer64.bytecode,
        arguments: [dataHandler.contractAddress, incentiveMechanism.contractAddress, model.contractAddress],
      }).send({
        from: account,
      }).on('transactionHash', transactionHash => {
        this.dismissNotification(pleaseAcceptKey);
        this.notify(`Submitted the data handler with transaction hash: ${transactionHash}. Please wait for a deployment confirmation.`);
      }).on('receipt', mainContract => {
        this.notify(`The main entry point contract has been deployed to ${mainContract.contractAddress}`, { variant: 'success' });
        this.notify(`Please accept the next 3 transactions to transfer ownership of the components to the main entry point contract`);
        return Promise.all([
          dataHandler.methods.transferOwnership(mainContract.contractAddress).send({
            from: account
          }),
          incentiveMechanism.methods.transferOwnership(mainContract.contractAddress).send({
            from: account
          }),
          model.methods.transferOwnership(mainContract.contractAddress).send({
            from: account
          }),
        ]).then(_ => {
          resolve(mainContract);
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
