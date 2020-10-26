import Button from '@material-ui/core/Button';
import Container from '@material-ui/core/Container';
import Grid from '@material-ui/core/Grid';
import InputLabel from '@material-ui/core/InputLabel';
import Link from '@material-ui/core/Link';
import MenuItem from '@material-ui/core/MenuItem';
import Paper from '@material-ui/core/Paper';
import Select from '@material-ui/core/Select';
import { withStyles } from '@material-ui/core/styles';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import TextField from '@material-ui/core/TextField';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';
import update from 'immutability-helper';
import { withSnackbar } from 'notistack';
import PropTypes from 'prop-types';
import React from 'react';
import Dropzone from 'react-dropzone';
import CollaborativeTrainer64 from '../contracts/compiled/CollaborativeTrainer64.json';
import DataHandler64 from '../contracts/compiled/DataHandler64.json';
import Points64 from '../contracts/compiled/Points64.json';
import Stakeable64 from '../contracts/compiled/Stakeable64.json';
import { Encoder } from '../encoding/encoder';
import { getNetworkType, getWeb3 } from '../getWeb3';
import { ModelDeployer } from '../ml-models/deploy-model';
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
    wordBreak: 'break-word',
  },
});

class AddModel extends React.Component {

  constructor(props) {
    super(props)
    this.classes = props.classes

    this.web3 = null

    // Default to local storage for storing original data.
    const storageType = localStorage.getItem('storageType') || 'local'
    this.storages = DataStoreFactory.getAll()

    this.state = {
      name: "",
      description: "",
      toFloat: 1E9,
      modelType: 'Classifier64',
      modelFileName: undefined,
      encoder: Encoder.None,
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

    this.notify = this.notify.bind(this)
    this.dismissNotification = this.dismissNotification.bind(this)
    this.saveAddress = this.saveAddress.bind(this)
    this.saveTransactionHash = this.saveTransactionHash.bind(this)

    this.save = this.save.bind(this)
    this.handleInputChange = this.handleInputChange.bind(this)
    this.processUploadedModel = this.processUploadedModel.bind(this)
  }

  componentDidMount = async () => {
    checkStorages(this.storages).then(permittedStorageTypes => {
      permittedStorageTypes.push('none')
      this.setState({ permittedStorageTypes })
    })
    window.ethereum.on('chainChanged', _ => {
      this.setupWeb3()
    })
    this.setupWeb3()
  }

  async setupWeb3() {
    try {
      this.web3 = await getWeb3()
      this.deployer = new ModelDeployer(this.web3)
      this.setState({ networkType: await getNetworkType() })
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

  saveTransactionHash(key, transactionHash) {
    this.setState({ deploymentInfo: update(this.state.deploymentInfo, { [key]: { transactionHash: { $set: transactionHash } } }) });
  }

  saveAddress(key, address) {
    this.setState({ deploymentInfo: update(this.state.deploymentInfo, { [key]: { address: { $set: address } } }) });
  }

  handleInputChange(event) {
    const target = event.target
    let value = target.type === "checkbox" ? target.checked : target.value
    if (event.target.type === 'number') {
      value = parseInt(value)
    }
    const name = target.name

    let valid = true
    if (['costWeight', 'refundTimeWaitTimeS', 'ownerClaimWaitTimeS', 'anyAddressClaimWaitTimeS'].indexOf(name) >= 0) {
      if (value < 0) {
        this.notify(`The value for ${name} must be at least 0`, { variant: 'error' })
        valid = false
      }
    }
    if (valid) {
      this.setState({
        [name]: value
      }, _ => {
        if (name === 'storageType') {
          localStorage.setItem(name, value);
        }
      });
    }
  }

  processUploadedModel(acceptedFiles) {
    this.setState({ model: undefined, modelFileName: undefined }, _ => {
      if (acceptedFiles.length !== 1) {
        this.notify("Please only provide one file", { variant: 'error' })
        return
      }
      const reader = new FileReader();
      const file = acceptedFiles[0];
      reader.onabort = () => console.error("File reading was aborted.");
      reader.onerror = () => console.error("File reading has failed.");
      reader.onload = () => {
        try {
          const binaryStr = reader.result
          const model = JSON.parse(binaryStr);

          if (!(model.type in ModelDeployer.modelTypes)) {
            this.notify(`The "type" of the model must be one of ${JSON.stringify(Object.keys(ModelDeployer.modelTypes))}`, { variant: 'error' })
          } else {
            this.setState({
              model, modelFileName: file.path,
              encoder: model.encoder || this.state.encoder,
            })
          }
        } catch (err) {
          console.error(`Error reading "${file.path}".`)
          console.error(err)
          this.notify(`There was an error reading ${file.path}. See the console for details.`, { variant: 'error' })
        }
      }
      reader.readAsBinaryString(file)
    })
  }

  getDisabledReason() {
    if (this.state.deploymentInfo.main.address !== undefined) {
      return "Already deployed"
    }
    if (this.state.model === undefined) {
      return "A model file must be uploaded"
    }
    if (!(this.state.refundTimeWaitTimeS <= this.state.ownerClaimWaitTimeS)) {
      return "The refund/reward wait time must be at most the owner wait time"
    }
    if (!(this.state.ownerClaimWaitTimeS <= this.state.anyAddressClaimWaitTimeS)) {
      return "The owner wait time must be at most the full deposit take wait time"
    }
    if (this.state.costWeight < 0) {
      return "The deposit wait must be at least 0"
    }
    return null
  }

  render() {
    let disableReason = this.getDisabledReason()

    return (
      <Container>
        <Paper className={this.classes.root} elevation={1}>
          <Typography variant="h5" component="h3">
            Add your model
          </Typography>
          <Typography component="p">
            Provide the information for the model and then deploy it to a blockchain.
            You can hover over (or long press for touch screens) certain items to get more details.
          </Typography>
          <Typography component="p">
            If you want to use a model that is already deployed, then you can add its information <Link href='/addDeployedModel'>here</Link>.
          </Typography>
          <Typography component="p">
              ⚠ WARNING When you click/tap on the SAVE button, transactions will be created for you to approve in your browser's tool (e.g. MetaMask).
              If the transactions are approved, you might be sending data to a public dencentralized blockchain not controlled by Microsoft.
              Before approving, you should understand the implications of interacting with a public blockchain.
              You can learn more <Link href='/about' target='_blank'>here</Link>.
            </Typography>

          <form className={this.classes.container} noValidate autoComplete="off">
            <div className={this.classes.form} >
              <TextField
                name="name"
                label="Model name"
                inputProps={{ 'aria-label': "Model name" }}
                margin="normal"
                onChange={this.handleInputChange}
              />
              <TextField
                name="description"
                label="Model description"
                inputProps={{ 'aria-label': "Model description" }}
                margin="normal"
                onChange={this.handleInputChange}
              />

              {/* Encoder */}
              <Typography variant="h6" component="h6">
                Encoder
              </Typography>
              <Typography component="p">
                An encoder is the method that is used to convert the input (text, image, etc.) into a machine readable format.
              </Typography>
              <Select className={this.classes.selector}
                onChange={this.handleInputChange}
                value={this.state.encoder}
                inputProps={{
                  name: 'encoder',
                }}
              >
                <Tooltip value={Encoder.None} placement="top-start"
                  title="No transformation will be applied (except for whatever is required to send the data to the contract such as converting to hexadecimal)">
                  <MenuItem>None (for raw integer data)</MenuItem>
                </Tooltip>
                <Tooltip value={Encoder.Mult1E9Round} placement="top-start"
                  title="Each number will be multiplied by 10^9 and then rounded since smart contracts use integers instead of decimal numbers">
                  <MenuItem>Multiply by 10^9, then round (for raw decimal numbers)</MenuItem>
                </Tooltip>
                <Tooltip value={Encoder.MurmurHash3} placement="top-start"
                  title="Convert each word to a 32-bit number using MurmurHash3. Separates word using spaces.">
                  <MenuItem>MurmurHash3 (for text with sparse models)</MenuItem>
                </Tooltip>
                <Tooltip value={Encoder.ImdbVocab} placement="top-start"
                  title="Convert each word in English text to a number using the 1000 most frequent words in the IMDB review dataset">
                  <MenuItem>IMDB vocab (for a limited set of English text)</MenuItem>
                </Tooltip>
                <Tooltip value={Encoder.USE} placement="top-start"
                  title="Use the Universal Sentence Encoder to convert English text to a vector of numbers">
                  <MenuItem>Universal Sentence Encoder (for English text with dense models)</MenuItem>
                </Tooltip>
                <Tooltip value={Encoder.MobileNetV2} placement="top-start"
                  title="Use MobileNetV2 to convert images to a vector of numbers">
                  <MenuItem>MobileNetV2 (for images with dense models)</MenuItem>
                </Tooltip>
              </Select>

              {/* Model */}
              {/* Don't need to ask for the model type since there is only one option and in the future, it should be inferred from the provided file.
              <InputLabel className={this.classes.selectorLabel} htmlFor="model-type">Model type</InputLabel>
              <Select className={this.classes.selector}
                onChange={this.handleInputChange}
                value={this.state.modelType}
                inputProps={{
                  name: 'modelType',
                }}
              >
                <MenuItem value={"Classifier64"}>Classifier64</MenuItem>
              </Select> */}

              <Typography variant="h6" component="h6">
                Model
              </Typography>
              <Typography component="p">
                Provide a file containing the model's information.
                The syntax for the file can be found <Link href='https://github.com/microsoft/0xDeCA10B/wiki/Models#model-files' target='_blank'>here</Link>.
              </Typography>

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

              {/* Incentive Mechanism */}
              <Tooltip placement="top-start"
                title={"The system that will be used to determine rewards for data that is determined to be \"good\"."}>
                <InputLabel className={this.classes.selectorLabel} htmlFor="incentiveMechanism">Incentive mechanism (IM)</InputLabel>
              </Tooltip>
              <Select className={this.classes.selector}
                onChange={this.handleInputChange}
                value={this.state.incentiveMechanism}
                inputProps={{
                  name: 'incentiveMechanism',
                }}
              >
                <Tooltip value="Points64" placement="top-start"
                  title="Collect and earn points. No deposits required.">
                  <MenuItem>Points</MenuItem>
                </Tooltip>
                <Tooltip value="Stakeable64" placement="top-start"
                  title="Stake a deposit when giving data. Contributors have the possibility to earn rewards by taking the deposits of others.">
                  <MenuItem>Stakeable</MenuItem>
                </Tooltip>
              </Select>
              {this.state.incentiveMechanism === 'Points64' &&
                this.renderPointsOptions()
              }
              {this.state.incentiveMechanism === 'Stakeable64' &&
                this.renderStakeableOptions()
              }

              {/* Storage */}
              <Typography variant="h6" component="h6">
                Model Meta-data Storage
              </Typography>
              <Typography component="p">
                When you click the save button below, you will be prompted to store your model on a blockchain.
                In the next selection field, you can choose if you want to store meta-data for this model so that you can easily find it using this demo website.
              </Typography>
              <div className={this.classes.selector}>
                {renderStorageSelector("Where to store the supplied meta-data about this model like its address",
                  this.state.storageType, this.handleInputChange, this.state.permittedStorageTypes)}
              </div>
            </div>
          </form>
          {this.state.networkType === 'main' && <Typography component="p">
            {"⚠ You are currently set up to deploy to a main network. Please consider deploying to a test network before deploying to a main network. "}
          </Typography>}

          {disableReason !== null && <Typography component="p">
            ⚠ {disableReason}
          </Typography>}
          <Button className={this.classes.button} variant="outlined" color="primary" onClick={this.save}
            disabled={disableReason !== null}
          >
            Save
          </Button>
        </Paper>
        <Paper className={this.classes.root} elevation={1}>
          <Typography component="h3">
            Deployment Status
          </Typography>
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

  renderCommonImOptions() {
    return <Grid container spacing={2}>
      <Grid item xs={12} sm={6}>
        <Tooltip placement="top-start"
          title={"The amount of time that anyone must wait after submitting data before requesting a refund and to verify data you claim is correct. \
            This is also the amount of time that anyone must wait before reporting another account's data as incorrect."}>
          <TextField name="refundTimeWaitTimeS" label="Refund/reward wait time (seconds)"
            inputProps={{ 'aria-label': "Refund wait time in seconds" }}
            className={this.classes.numberTextField}
            value={this.state.refundTimeWaitTimeS}
            type="number"
            margin="normal"
            onChange={this.handleInputChange} />
        </Tooltip>
      </Grid>
      <Grid item xs={12} sm={6}>
        <Tooltip placement="top-start"
          title={"The amount of time that the \"owner\" of the smart contracts must wait before taking another account's full deposit given with their data contribution"}>
          <TextField name="ownerClaimWaitTimeS" label="Full deposit take wait time for owner (seconds)"
            inputProps={{ 'aria-label': "Owner claim wait time in seconds" }}
            className={this.classes.numberTextField}
            value={this.state.ownerClaimWaitTimeS}
            type="number"
            margin="normal"
            onChange={this.handleInputChange} />
        </Tooltip>
      </Grid>
      <Grid item xs={12} sm={6}>
        <Tooltip placement="top-start"
          title={"The amount of time that anyone must wait before taking another account's full deposit given with their data contribution"}>
          <TextField name="anyAddressClaimWaitTimeS" label="Full deposit take wait time (seconds)"
            inputProps={{ 'aria-label': "Any address claim wait time in seconds" }}
            className={this.classes.numberTextField}
            value={this.state.anyAddressClaimWaitTimeS}
            type="number"
            margin="normal"
            onChange={this.handleInputChange} />
        </Tooltip>
      </Grid>
    </Grid>
  }

  renderStakeableOptions() {
    return <div>
      {this.renderCommonImOptions()}
      <Grid container spacing={2}>
        <Grid item xs={12} sm={12}>
          <Tooltip placement="top-start"
            title={"A multiplicative factor to the required deposit. \
            Setting this to 0 will mean that no deposit is required but will allow you to stil use the IM to track \"good\" and \"bad\" contributions."}>
            <TextField name="costWeight" label="Deposit weight (in wei)"
              inputProps={{ 'aria-label': "Deposit weight in wei" }}
              className={this.classes.numberTextField}
              value={this.state.costWeight}
              type="number"
              margin="normal"
              onChange={this.handleInputChange} />
          </Tooltip>
        </Grid>
      </Grid>
    </div>
  }

  renderPointsOptions() {
    return <div>
      <Typography component="p">
        No deposits will be required.
      </Typography>
      {this.renderCommonImOptions()}
    </div>
  }

  async save() {
    // TODO Keep track of contract addresses of whatever has been deployed so far so that the process can be recovered.
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

      // Deploy the model first since it is more likely something will go wrong with deploying it compared to the other contracts.
      const model = await this.deployer.deployModel(this.state.model, {
        account,
        toFloat: this.state.toFloat,
        notify: this.notify, dismissNotification: this.dismissNotification,
        saveTransactionHash: this.saveTransactionHash, saveAddress: this.saveAddress,
      })

      const [dataHandler, incentiveMechanism] = await Promise.all([
        this.deployDataHandler(account),
        this.deployIncentiveMechanism(account),
      ]);

      const mainContract = await this.deployMainEntryPoint(account, dataHandler, incentiveMechanism, model);

      modelInfo.address = mainContract.options.address;

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
          if (err.response && err.response.data && err.response.data.message) {
            console.error(err.response.data.message)
          }
          this.notify("There was an error saving the model information. Check the console for details.",
            { variant: 'error' })
        });
      }
    });
  }

  async deployIncentiveMechanism(account) {
    let contractInfo, notification, args
    const { incentiveMechanism,
      refundTimeWaitTimeS, ownerClaimWaitTimeS, anyAddressClaimWaitTimeS,
      costWeight } = this.state
    switch (incentiveMechanism) {
      case 'Points64':
        contractInfo = Points64
        args = [refundTimeWaitTimeS, ownerClaimWaitTimeS, anyAddressClaimWaitTimeS]
        break
      case 'Stakeable64':
        contractInfo = Stakeable64
        args = [refundTimeWaitTimeS, ownerClaimWaitTimeS, anyAddressClaimWaitTimeS, costWeight]
        break
      default:
        // Should not happen.
        this.notify(`Unrecognized incentive mechanism: "${incentiveMechanism}"`, { variant: 'error' });
        throw new Error(`Unrecognized incentive mechanism: "${incentiveMechanism}"`);
    }

    const imContract = new this.web3.eth.Contract(contractInfo.abi, {
      from: account,
    })

    const pleaseAcceptKey = this.notify("Please accept the prompt to deploy the incentive mechanism contract")
    const result = imContract.deploy({
      data: contractInfo.bytecode,
      arguments: args,
    }).send({
    }).on('transactionHash', transactionHash => {
      this.dismissNotification(pleaseAcceptKey);
      notification = this.notify(`Submitted the incentive mechanism with transaction hash: ${transactionHash}. Please wait for a deployment confirmation.`);
      this.saveTransactionHash('incentiveMechanism', transactionHash);
    }).on('receipt', receipt => {
      if (notification !== undefined) {
        this.dismissNotification(notification)
      }
      this.notify(`The incentive mechanism contract has been deployed to ${receipt.contractAddress}`, { variant: 'success' });
      this.saveAddress('incentiveMechanism', receipt.contractAddress);
    }).on('error', err => {
      this.dismissNotification(pleaseAcceptKey);
      console.error(err);
      this.notify("Error deploying the incentive mechanism", { variant: 'error' });
      throw err;
    });

    return result;
  }

  async deployDataHandler(account) {
    const pleaseAcceptKey = this.notify("Please accept the prompt to deploy the data handler")
    let notification
    const dataHandlerContract = new this.web3.eth.Contract(DataHandler64.abi, {
      from: account,
    });
    return dataHandlerContract.deploy({
      data: DataHandler64.bytecode,
    }).send({
    }).on('transactionHash', transactionHash => {
      this.dismissNotification(pleaseAcceptKey);
      notification = this.notify(`Submitted the data handler with transaction hash: ${transactionHash}. Please wait for a deployment confirmation.`);
      this.saveTransactionHash('dataHandler', transactionHash);
    }).on('receipt', receipt => {
      if (notification !== undefined) {
        this.dismissNotification(notification)
      }
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
    const pleaseAcceptKey = this.notify("Please accept the prompt to deploy the main entry point contact")
    let notification
    const collaborativeTrainer64Contract = new this.web3.eth.Contract(CollaborativeTrainer64.abi, {
      from: account,
    })
    return collaborativeTrainer64Contract.deploy({
      data: CollaborativeTrainer64.bytecode,
      arguments: [
        this.state.name, this.state.description, this.state.encoder,
        dataHandler.options.address, incentiveMechanism.options.address, model.options.address
      ],
    }).send({
    }).on('transactionHash', transactionHash => {
      this.dismissNotification(pleaseAcceptKey);
      notification = this.notify(`Submitted the main entry point with transaction hash: ${transactionHash}. Please wait for a deployment confirmation.`);
      this.saveTransactionHash('main', transactionHash);
    }).on('receipt', receipt => {
      if (notification !== undefined) {
        this.dismissNotification(notification)
      }
      this.notify(`The main entry point contract has been deployed to ${receipt.contractAddress}`, { variant: 'success' });
      this.saveAddress('main', receipt.contractAddress);
    }).on('error', err => {
      this.dismissNotification(pleaseAcceptKey);
      console.error(err);
      this.notify(`Error deploying the main entry point contract`, { variant: 'error' });
      throw err;
    }).then(newContractInstance => {
      notification = this.notify(`Please accept the next 3 transactions to transfer ownership of the components to the main entry point contract`);
      return Promise.all([
        dataHandler.methods.transferOwnership(newContractInstance.options.address).send(),
        incentiveMechanism.methods.transferOwnership(newContractInstance.options.address).send(),
        model.methods.transferOwnership(newContractInstance.options.address).send(),
      ]).then(_ => {
        this.dismissNotification(notification)
        return newContractInstance;
      });
    });
  }
}

AddModel.propTypes = {
  classes: PropTypes.object.isRequired,
};

export default withSnackbar(withStyles(styles)(AddModel));
