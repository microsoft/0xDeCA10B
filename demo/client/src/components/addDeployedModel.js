import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import green from '@material-ui/core/colors/green';
import Container from '@material-ui/core/Container';
import Grid from '@material-ui/core/Grid';
import InputLabel from '@material-ui/core/InputLabel';
import MenuItem from '@material-ui/core/MenuItem';
import Paper from '@material-ui/core/Paper';
import Select from '@material-ui/core/Select';
import { withStyles } from '@material-ui/core/styles';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import CheckIcon from '@material-ui/icons/Check';
import ClearIcon from '@material-ui/icons/Clear';
import { withSnackbar } from 'notistack';
import PropTypes from 'prop-types';
import React from 'react';
import { ContractLoader } from '../contracts/loader';
import { Encoder } from '../encoding/encoder';
import { getNetworkType, getWeb3 } from '../getWeb3';
import { OnlineSafetyValidator } from '../safety/validator';
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
    paddingTop: 20,
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
  },
  contractStatus: {
    marginTop: 30,
  },
  addressInput: {
    maxWidth: 400,
  },
  input: {
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
  detailsDivider: {
    paddingTop: 20,
  },
})

class AddDeployedModel extends React.Component {

  constructor(props) {
    super(props)
    this.classes = props.classes

    this.validator = new OnlineSafetyValidator()
    this.web3 = null

    // Default to local storage for storing original data.
    const storageType = localStorage.getItem('storageType') || 'local'
    this.storages = DataStoreFactory.getAll()

    this.state = {
      // The contract at the specific address is valid.
      isValid: undefined,
      validatingContract: false,
      address: undefined,
      name: undefined,
      description: undefined,
      modelType: 'Classifier64',
      encoder: undefined,
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
      this.contractLoader = new ContractLoader(this.web3)
    } catch (error) {
      this.notify("Failed to load web3, accounts, or contract. Check console for details.", { variant: 'error' })
      console.error(error)
      return
    }

    const currentUrlParams = new URLSearchParams(window.location.search)
    const address = currentUrlParams.get('address')
    if (address) {
      this.setState({ address }, this.validateContract)
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
        this.validateContract()
      }
    })
  }

  validateContract() {
    this.setState({
      restrictContent: undefined,
      isValid: undefined,
      validatingContract: true,
      invalidReason: undefined,
    }, async () => {
      const { address } = this.state

      if (!address || address.length === 0) {
        this.setState({
          isValid: undefined,
          validatingContract: false,
          invalidReason: "No address was given",
        })
        return
      }

      // Make sure not already stored.
      const storage = this.storages[this.state.storageType]
      try {
        await storage.getModel(null, address)
        this.setState({
          isValid: false,
          validatingContract: false,
          invalidReason: "A model at this address has already been recorded",
        })
        this.notify("A model at this address has already been recorded", { variant: 'error' })
        return
      } catch (_) {
        // Nothing was found.
      }

      this.contractLoader.load(address).then(async collabTrainer => {
        const restrictContent = !this.validator.isPermitted(await getNetworkType(), address)
        // Be careful that the name and description do not leak if content is restricted.
        const name = restrictContent ? undefined : await collabTrainer.name()
        const description = restrictContent ? undefined : await collabTrainer.description()
        const encoder = await collabTrainer.encoder()
        this.setState({
          name, description, encoder,
          restrictContent,
          isValid: true,
          validatingContract: false,
        })
      }).catch(err => {
        console.error(err)
        this.setState({
          isValid: false,
          validatingContract: false,
          invalidReason: err.toString(),
        })
        this.notify(`The contract is not valid: ${err}`, { variant: 'error' })
        return
      })
    })
  }

  renderContractStatus() {
    let status, detailedStatus
    if (this.state.validatingContract) {
      status = <CircularProgress size={25} />
      detailedStatus = "Checking"
    } else if (this.state.isValid) {
      status = <CheckIcon style={{ color: green[500] }} />
      detailedStatus = "The contract is likely valid"
    } else if (this.state.isValid === false) {
      status = <ClearIcon color="error" />
      detailedStatus = `The contract is likely invalid${this.state.invalidReason !== undefined ? `. ${this.state.invalidReason}.` : ""}`
    } else {
      detailedStatus = "enter a contract address"
    }
    return (<Grid container spacing={2}>
      <Grid item>
        <Typography component="p">
          Contract Status:
        </Typography>
      </Grid>
      <Grid item xs={1}>
        {status}
      </Grid>
      <Grid item>
        <Typography component="p">
          {detailedStatus}
        </Typography>
      </Grid>
    </Grid>)
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
            Provide the address for the entry point contract that has already been deployed to a blockchain.
            Then you will be prompted for other information about the contract.
          </Typography>
          <form className={this.classes.container} noValidate autoComplete="off">
            <div className={this.classes.form} >
              {this.renderContractStatus()}
              <TextField
                name="address"
                label="Entry point address"
                value={this.state.address || ""}
                inputProps={{ 'aria-label': "Entry point address" }}
                className={this.classes.addressInput}
                margin="normal"
                onChange={this.handleInputChange}
              />
              <div className={this.classes.selector}>
                {renderStorageSelector("Where to store the supplied meta-data about this model",
                  this.state.storageType, this.handleInputChange, this.state.permittedStorageTypes)}
              </div>
              <div className={this.classes.detailsDivider}></div>
              <Typography component="p">
                Provide a valid contract address before filling out the rest of the fields.
              </Typography>
              <TextField
                name="name"
                label="Model name"
                value={this.state.restrictContent ? "" : this.state.name || ""}
                inputProps={{ 'aria-label': "Model name" }}
                margin="normal"
                onChange={this.handleInputChange}
                disabled={!this.state.isValid}
              />
              <TextField
                name="description"
                label="Model description"
                value={this.state.restrictContent ? "" : this.state.description || ""}
                inputProps={{ 'aria-label': "Model description" }}
                margin="normal"
                onChange={this.handleInputChange}
                disabled={!this.state.isValid}
              />
              <InputLabel className={this.classes.selectorLabel} htmlFor="model-type">Model type</InputLabel>
              <Select className={this.classes.selector}
                onChange={this.handleInputChange}
                value={this.state.modelType}
                inputProps={{
                  name: 'modelType',
                }}
                disabled={!this.state.isValid}
              >
                <MenuItem value={"Classifier64"}>Classifier64</MenuItem>
              </Select>

              {(this.state.restrictContent === false || Object.values(Encoder).indexOf(this.state.encoder) > -1) && <div>
                <Typography variant="h6" component="h6">
                  Encoder: {this.state.encoder}
                </Typography>
                <Typography component="p">
                  An encoder is the method that is used to convert the input (text, image, etc.) into a machine readable format.
                </Typography>
              </div>}
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
    const { address, name, description, modelType } = this.state;

    // Validate
    if (!name) {
      this.notify("Please provide a name", { variant: 'error' });
      return
    }
    if (modelType === undefined) {
      this.notify("You must select model type", { variant: 'error' });
      return
    }

    const modelInfo = new ModelInformation({ name, address, description, modelType })

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
      this.notify("There was an error saving the model information. Check the console for details.",
        { variant: 'error' })
    })
  }
}

AddDeployedModel.propTypes = {
  classes: PropTypes.object.isRequired,
}

export default withSnackbar(withStyles(styles)(AddDeployedModel))
