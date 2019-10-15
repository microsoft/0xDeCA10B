import getWeb3 from "@drizzle-utils/get-web3";
import { Container, InputLabel, MenuItem, Select } from "@material-ui/core";
import Button from '@material-ui/core/Button';
import Paper from '@material-ui/core/Paper';
import { withStyles } from '@material-ui/core/styles';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import axios from 'axios';
import PropTypes from 'prop-types';
import React from 'react';
import Dropzone from 'react-dropzone';
import Web3 from "web3"; // Only required for custom/fallback provider option.

const styles = theme => ({
  root: {
    ...theme.mixins.gutters(),
    paddingTop: theme.spacing.unit * 2,
    paddingBottom: theme.spacing.unit * 2,
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

  createNewContract(callback) {
    // TODO Get labels as input.
    // TODO Get abi to use.

    this.web3.eth.getAccounts((error, accounts) => {
      // TODO Deploy new contract or use existing one.
    });
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
    const file = acceptedFiles[0];
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
                <div>
                  <TextField
                    name="refundTimeWaitTimeS"
                    label="Refund wait time (seconds)"
                    value={this.state.refundTimeWaitTimeS}
                    type="number"
                    margin="normal"
                    onChange={this.handleInputChange}
                  />
                  <TextField
                    name="ownerClaimWaitTimeS"
                    label="Owner claim wait time (seconds)"
                    value={this.state.ownerClaimWaitTimeS}
                    type="number"
                    margin="normal"
                    onChange={this.handleInputChange}
                  />
                  <TextField
                    name="anyAddressClaimWaitTimeS"
                    label="Any address claim wait time (seconds)"
                    value={this.state.anyAddressClaimWaitTimeS}
                    type="number"
                    margin="normal"
                    onChange={this.handleInputChange}
                  />
                  <TextField
                    name="costWeight"
                    label="Cost weight (in wei)"
                    value={this.state.costWeight}
                    type="number"
                    margin="normal"
                    onChange={this.handleInputChange}
                  />
                  {/* End section for Stakeable64. */}
                </div>
              }
              <Dropzone onDrop={this.processUploadedModel}>
                {({ getRootProps, getInputProps }) => (<section>
                  <div {...getRootProps()}>
                    <input {...getInputProps()} />
                    <Typography component="p">
                      Drag and drop a model file here, or click to select a file
                    </Typography>
                  </div>
                </section>)}
              </Dropzone>
            </div>
          </form>
          <Button className={this.classes.button} variant="outlined" color="primary" onClick={this.save}> Save </Button>
        </Paper>
      </Container>
    );
  }

  save() {
    //deploy contract, get address, save to db
    this.createNewContract(i => {
      axios.post('/api/models', { ...this.state, address: i.address });
    });
  }
}

AddModel.propTypes = {
  classes: PropTypes.object.isRequired,
};

export default withStyles(styles)(AddModel);
