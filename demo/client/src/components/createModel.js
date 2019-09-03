import getWeb3 from "@drizzle-utils/get-web3";
import Button from '@material-ui/core/Button';
import Paper from '@material-ui/core/Paper';
import { withStyles } from '@material-ui/core/styles';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import axios from 'axios';
import PropTypes from 'prop-types';
import React from 'react';
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
  }
});

class CreateModel extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      json: null,
      name: '',
      description: '',
      ownerClaimWaitTimeS: 0,
      refundTime: 0,
      costWeight: 0
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

  render() {
    return (
      <div>
        <Paper className={this.classes.root} elevation={1}>
          <Typography variant="h5" component="h3">
            New Model
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
                label="Model Description"
                className={this.classes.textField}
                margin="normal"
                onChange={this.handleInputChange}
              />
              <TextField
                name="ownerClaimWaitTimeS"
                label="Claim Time"
                className={this.classes.textField}
                margin="normal"
                onChange={this.handleInputChange}
              />
              <TextField
                name="refundTime"
                label="Refund Time"
                className={this.classes.textField}
                margin="normal"
                onChange={this.handleInputChange}
              />
              <br />
              <Typography component="p">
                Weights
               </Typography>
              <input
                accept="application/json"
                className={this.classes.button}
                id="flat-button-file"
                type="file"
                onChange={this.uploadWeights}
              />
            </div>
          </form>
          <Button className={this.classes.button} variant="outlined" color="primary" onClick={this.save}> Save </Button>
        </Paper>
      </div>
    );
  }

  save() {
    //deploy contract, get address, save to db
    this.createNewContract(i => {
      axios.post('/api/models', { ...this.state, address: i.address });
    });
  }
}

CreateModel.propTypes = {
  classes: PropTypes.object.isRequired,
};

export default withStyles(styles)(CreateModel);