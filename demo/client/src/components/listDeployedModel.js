import Button from '@material-ui/core/Button';
import Container from '@material-ui/core/Container';
import InputLabel from '@material-ui/core/InputLabel';
import MenuItem from '@material-ui/core/MenuItem';
import Paper from '@material-ui/core/Paper';
import Select from '@material-ui/core/Select';
import { withStyles } from '@material-ui/core/styles';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import update from 'immutability-helper';
import { withSnackbar } from 'notistack';
import PropTypes from 'prop-types';
import React from 'react';
import DensePerceptron from '../contracts/compiled/DensePerceptron.json';
import SparsePerceptron from '../contracts/compiled/SparsePerceptron.json';
import { getWeb3 } from '../getWeb3';
import { ModelInformation } from '../storage/data-store';
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
    cursor: 'pointer',
    paddingTop: theme.spacing(2),
    paddingBottom: theme.spacing(2),
  },
  table: {
    minWidth: 650,
    wordBreak: 'break-word',
  },
});

class ListDeployedModel extends React.Component {

  constructor(props) {
    super(props);
    this.classes = props.classes;

    this.modelTypes = {
      'dense perceptron': DensePerceptron,
      'sparse perceptron': SparsePerceptron,
    };
    this.web3 = null;

    // Default to local storage for storing original data.
    const storageType = localStorage.getItem('storageType') || 'local';
    this.storages = DataStoreFactory.getAll()

    this.state = {
      name: "",
      description: "",
      toFloat: 1E9,
      modelType: 'Classifier64',
      modelFileName: undefined,
      encoder: 'none',
      incentiveMechanism: 'Points64',
      refundTimeWaitTimeS: 0,
      ownerClaimWaitTimeS: 0,
      anyAddressClaimWaitTimeS: 0,
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
    }

    this.save = this.save.bind(this)
    this.handleInputChange = this.handleInputChange.bind(this)
  }

  componentDidMount = async () => {
    checkStorages(this.storages).then(permittedStorageTypes => {
      this.setState({ permittedStorageTypes })
    })
    try {
      this.web3 = await getWeb3()
    } catch (error) {
      this.notify("Failed to load web3, accounts, or contract. Check console for details.", { variant: 'error' })
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

  handleInputChange(event) {
    const target = event.target
    const value = target.type === "checkbox" ? target.checked : target.value
    const name = target.name

    this.setState({
      [name]: value
    }, _ => {
      if (name === 'storageType') {
        localStorage.setItem(name, value)
      }
    })
  }

  render() {
    const disableSave = this.state.deploymentInfo.main.address !== undefined
      || !(this.state.refundTimeWaitTimeS <= this.state.ownerClaimWaitTimeS)
      || !(this.state.ownerClaimWaitTimeS <= this.state.anyAddressClaimWaitTimeS)
      || this.state.costWeight < 0;
    return (
      <Container>
        <Paper className={this.classes.root} elevation={1}>
          <Typography variant="h5" component="h3">
            List a deployed model
          </Typography>
          <form className={this.classes.container} noValidate autoComplete="off">
            <div className={this.classes.form} >
              <TextField
                name="address"
                label="Entry point address"
                inputProps={{ 'aria-label': "Entry point address" }}
                className={this.classes.textField}
                margin="normal"
                onChange={this.handleInputChange}
              />
              {/* TODO Populate name and other fileds in the contract then allow the user to change their local versions. */}
              <TextField
                name="name"
                label="Model name"
                inputProps={{ 'aria-label': "Model name" }}
                className={this.classes.textField}
                margin="normal"
                onChange={this.handleInputChange}
              />
              <TextField
                name="description"
                label="Model description"
                inputProps={{ 'aria-label': "Model description" }}
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
              <div className={this.classes.selector}>
                {renderStorageSelector("where to store the supplied meta-data about this model like its address",
                  this.state.storageType, this.handleInputChange, this.state.permittedStorageTypes)}
              </div>
            </div>
          </form>
          <Button className={this.classes.button} variant="outlined" color="primary" onClick={this.save}
            disabled={disableSave}
          >
            Save
          </Button>
        </Paper>
      </Container>
    );
  }



  async save() {
    // TODO
    const { name, description, model, modelType, encoder } = this.state;
    const modelInfo = new ModelInformation({ name, description, modelType, encoder })

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

      modelInfo.address = mainContract.options.address;

      // TODO Make sure storage type is not 'none'.
      if (this.state.storageType !== 'none') {
        // Save to a database.
        const storage = this.storages[this.state.storageType];
        storage.saveModelInformation(modelInfo).then(() => {
          // Redirect
          const redirectWaitS = 5
          this.notify(`Saved. Will redirect in ${redirectWaitS} seconds.`, { variant: 'success' })
          setTimeout(_ => {
            this.props.history.push(`/model?address=${mainContract.options.address}&metaDataLocation=${this.state.storageType}`)
          }, redirectWaitS * 1000)
        }).catch(err => {
          console.error(err)
          console.error(err.response.data.message)
          this.notify("There was an error saving the model information. Check the console for details.",
            { variant: 'error' })
        });
      }
    })
  }
}

ListDeployedModel.propTypes = {
  classes: PropTypes.object.isRequired,
}

export default withSnackbar(withStyles(styles)(ListDeployedModel))
