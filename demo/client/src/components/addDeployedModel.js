import Button from '@material-ui/core/Button';
import Container from '@material-ui/core/Container';
import InputLabel from '@material-ui/core/InputLabel';
import MenuItem from '@material-ui/core/MenuItem';
import Paper from '@material-ui/core/Paper';
import Select from '@material-ui/core/Select';
import { withStyles } from '@material-ui/core/styles';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
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

class AddDeployedModel extends React.Component {

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
      // The contract at the specific address is valid.
      isValid: false,
      address: undefined,
      name: "",
      description: "",
      toFloat: 1E9,
      modelType: 'Classifier64',
      modelFileName: undefined,
      encoder: 'none',
      incentiveMechanism: 'Points64',
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

  handleInputChange(event) {
    const target = event.target
    const value = target.type === "checkbox" ? target.checked : target.value
    const name = target.name

    this.setState({
      [name]: value
    }, _ => {
      if (name === 'storageType') {
        localStorage.setItem(name, value)
      } else if (name === 'address') {
        this.validateContract(value)
      }
    })
  }

  validateContract(address) {
    // TODO Validate contract at `address`.
    // TODO If online safety is disabled, then pre-populate the information from the contract.
    this.setState({ isValid: true })
  }

  render() {
    const disableSave = !this.state.isValid
    return (
      <Container>
        <Paper className={this.classes.root} elevation={1}>
          <Typography variant="h5" component="h3">
            List a deployed model
          </Typography>
          <Typography component="p">
            Provide the address for the entry point contract.
            Then you will be prompted for other information about the contract.
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
              <div className={this.classes.selector}>
                {renderStorageSelector("where to store the supplied meta-data about this model like its address",
                  this.state.storageType, this.handleInputChange, this.state.permittedStorageTypes)}
              </div>
              {/* TODO Disable some of these fields until address is given and validated. */}
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
    const { address, name, description, model, modelType, encoder } = this.state;
    const modelInfo = new ModelInformation({ name, address, description, modelType, encoder })

    // Validate
    if (!name) {
      this.notify("Please provide a name", { variant: 'error' });
      return;
    }
    if (modelType === undefined || model === undefined) {
      this.notify("You must select model type and provide a model file", { variant: 'error' });
      return;
    }

    // TODO Make sure storage type is not 'none'.
    if (this.state.storageType !== 'none') {
      // Save to a database.
      const storage = this.storages[this.state.storageType];
      storage.saveModelInformation(modelInfo).then(() => {
        // Redirect
        const redirectWaitS = 5
        this.notify(`Saved. Will redirect in ${redirectWaitS} seconds.`, { variant: 'success' })
        setTimeout(_ => {
          this.props.history.push(`/model?address=${address}&metaDataLocation=${this.state.storageType}`)
        }, redirectWaitS * 1000)
      }).catch(err => {
        console.error(err)
        console.error(err.response.data.message)
        this.notify("There was an error saving the model information. Check the console for details.",
          { variant: 'error' })
      });
    }
  }
}

AddDeployedModel.propTypes = {
  classes: PropTypes.object.isRequired,
}

export default withSnackbar(withStyles(styles)(AddDeployedModel))
