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
import CollaborativeTrainer from '../contracts/CollaborativeTrainer64.json';
import DataHandler from '../contracts/DataHandler64.json';
import Stakeable64 from '../contracts/Stakeable64.json';

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
      modelType: "Classifier64",
      encoder: "none",
      incentiveMechanism: "Points",
      refundTimeWaitTimeS: 60,
      ownerClaimWaitTimeS: 120,
      anyAddressClaimWaitTimeS: 300,
      costWeight: 1E15
    };
    this.classes = props.classes;
    this.web3 = null;
    this.uploadWeights = this.uploadWeights.bind(this);
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

  uploadWeights(e) {
    this.setState({ json: e.target.files[0] });
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
                <MenuItem value={"Points"}>Points</MenuItem>
                <MenuItem value={"Stakeable64"}>Stakeable64</MenuItem>
              </Select>
              {this.state.incentiveMechanism === "Stakeable64" &&
                this.renderStakeableOptions()
              }
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
    //deploy contract, get address, save to db
    const { name, description, modelType, encoder } = this.state;
    const modelInfo = {
      name, description, modelType, encoder,
    };
    this.web3.eth.getAccounts((error, accounts) => {
      const account = accounts[0];
      // TODO Deploy new contracts.
      // See https://ethereum.stackexchange.com/a/70539/9564 for an example.
      // .abi
      // .bytecode
      this.createNewContract(i => {
        modelInfo.address = i.address;
        axios.post('/api/models', modelInfo).then(() => {
          console.log("Saved");
        }).catch(err => {
          console.error(err);
        });
      });
    });
  }
}

AddModel.propTypes = {
  classes: PropTypes.object.isRequired,
};

export default withStyles(styles)(AddModel);
