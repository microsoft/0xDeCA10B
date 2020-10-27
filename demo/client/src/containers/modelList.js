import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import Container from '@material-ui/core/Container';
import IconButton from '@material-ui/core/IconButton';
import Link from '@material-ui/core/Link';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemSecondaryAction from '@material-ui/core/ListItemSecondaryAction';
import ListItemText from '@material-ui/core/ListItemText';
import Modal from '@material-ui/core/Modal';
import Paper from '@material-ui/core/Paper';
import { withStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import ClearIcon from '@material-ui/icons/Clear';
import DeleteIcon from '@material-ui/icons/Delete';
import { withSnackbar } from 'notistack';
import PropTypes from 'prop-types';
import React from 'react';
import update from 'immutability-helper';
import { checkStorages } from '../components/storageSelector';
import { getNetworkType } from '../getWeb3';
import { OnlineSafetyValidator } from '../safety/validator';
import { DataStoreFactory } from '../storage/data-store-factory';

const styles = theme => ({
  descriptionDiv: {
    // Indent a bit to better align with text in the list.
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
  },
  button: {
    marginTop: 20,
    marginBottom: 20,
    marginLeft: 10,
  },
  spinnerDiv: {
    textAlign: 'center',
    marginTop: theme.spacing(2),
  },
  listDiv: {
    marginTop: theme.spacing(2),
  },
  nextButtonContainer: {
    textAlign: 'end',
  },
  removeModal: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePaper: {
    border: '2px solid lightgrey',
    padding: '8px',
    'box-shadow': 'lightgrey',
  },
});

class ModelList extends React.Component {
  constructor(props) {
    super(props);

    this.validator = new OnlineSafetyValidator()
    this.storages = DataStoreFactory.getAll()
    this.storageAfterAddress = {}

    this.state = {
      loadingModels: true,
      numModelsRemaining: 0,
      models: [],
      permittedStorageTypes: [],
    }

    this.nextModels = this.nextModels.bind(this)

    this.RemoveItemModal = this.RemoveItemModal.bind(this);
  }

  componentDidMount = async () => {
    checkStorages(this.storages).then(permittedStorageTypes => {
      permittedStorageTypes = permittedStorageTypes.filter(storageType => storageType !== undefined)
      this.setState({ permittedStorageTypes }, () => {
        this.updateModels().then(() => {
          // These checks are done after `updateModels`, otherwise a cycle of refreshes is triggered somehow.
          if (typeof window !== "undefined" && window.ethereum) {
            window.ethereum.on('accountsChanged', _accounts => { window.location.reload() });
            window.ethereum.on('chainChanged', _chainId => { window.location.reload() })
          }
        })
      })
    })
  }

  notify(...args) {
    return this.props.enqueueSnackbar(...args);
  }

  dismissNotification(...args) {
    return this.props.closeSnackbar(...args);
  }

  nextModels() {
    this.setState({
      loadingModels: true,
      models: [],
      numModelsRemaining: 0
    }, this.updateModels)
  }

  async updateModels() {
    // TODO Also get valid contracts that the account has already interacted with.
    // TODO Filter out models that are not on this network.
    const networkType = await getNetworkType()
    const limit = 6
    return Promise.all(this.state.permittedStorageTypes.map(storageType => {
      const afterId = this.storageAfterAddress[storageType]
      return this.storages[storageType].getModels(afterId, limit).then(response => {
        const newModels = response.models
        const { remaining } = response
        newModels.forEach(model => {
          model.restrictContent = !this.validator.isPermitted(networkType, model.address)
          model.metaDataLocation = storageType
        })
        if (newModels.length > 0) {
          this.storageAfterAddress[storageType] = newModels[newModels.length - 1].address
        }

        this.setState(prevState => ({
          models: prevState.models.concat(newModels),
          numModelsRemaining: prevState.numModelsRemaining + remaining
        }))
      }).catch(err => {
        this.notify(`Could not get ${storageType} models`, { variant: 'error' })
        console.error(`Could not get ${storageType} models.`)
        console.error(err)
      })
    })).finally(_ => {
      this.setState({ loadingModels: false })
    })
  }

  handleStartRemove(removeItem, removeItemIndex) {
    this.setState({
      removeItem,
      removeItemIndex
    })
  }

  handleCancelRemove() {
    this.setState({
      removeItem: undefined,
      removeItemIndex: undefined,
    })
  }

  handleRemove() {
    const { removeItem, removeItemIndex } = this.state
    this.storages.local.removeModel(removeItem).then(response => {
      const { success } = response;
      if (success) {
        // Remove from the list.
        this.setState({
          removeItem: undefined,
          removeItemIndex: undefined,
          models: update(this.state.models, { $splice: [[removeItemIndex, 1]] }),
        });
        this.notify("Removed", { variant: "success" });
      } else {
        throw new Error("Error removing.");
      }
    }).catch(err => {
      console.error("Error removing.");
      console.error(err);
      this.notify("Error while removing", { variant: "error" });
    });
  }

  RemoveItemModal() {
    return (<Modal
      aria-labelledby="remove-item-modal-title"
      aria-describedby="remove-modal-title"
      open={this.state.removeItem !== undefined}
      onClose={() => { this.setState({ removeItem: undefined }) }}
      className={this.props.classes.removeModal}
    >
      <Paper className={this.props.classes.removePaper}>
        <Typography component="p" id="remove-choice-modal-title">
          {this.state.removeItem &&
            `Are you sure you would like to remove "${this.state.removeItem.name || this.state.removeItem.description}" from your local meta-data? This does not remove the model from the blockchain.`}
        </Typography>
        <Button className={this.props.classes.button} variant="outlined" //color="primary"
          size="small" onClick={() => this.handleRemove()}>
          Remove <DeleteIcon color="error" />
        </Button>
        <Button className={this.props.classes.button} variant="outlined" //color="primary"
          size="small" onClick={() => this.handleCancelRemove()}>
          Cancel <ClearIcon color="action" />
        </Button>
      </Paper>
    </Modal>);
  }

  render() {
    const listItems = this.state.models.map((m, index) => {
      const url = `/model?${m.id ? `modelId=${m.id}&` : ''}address=${m.address}&metaDataLocation=${m.metaDataLocation}&tab=predict`
      const allowRemoval = m.metaDataLocation === 'local'
      return (
        <ListItem key={`model-${index}`} button component="a" href={url}>
          <ListItemText primary={m.restrictContent ? `(name hidden) Address: ${m.address}` : m.name}
            secondary={m.accuracy && `Accuracy: ${(m.accuracy * 100).toFixed(1)}%`} />
          {/* For accessibility: keep secondary action even when disabled so that the <li> is used. */}
          <ListItemSecondaryAction>
            {allowRemoval &&
              <IconButton edge="end" aria-label="delete" onClick={(event) => {
                this.handleStartRemove(m, index); event.preventDefault()
              }} >
                <DeleteIcon />
              </IconButton>
            }
          </ListItemSecondaryAction>
        </ListItem>
      );
    });

    const serviceStorageEnabled = this.state.permittedStorageTypes.indexOf('service') > 0

    return (
      <div>
        <this.RemoveItemModal />
        <Container>
          <div className={this.props.classes.descriptionDiv}>
            <Typography variant="h5" component="h5">
              Welcome to Sharing Updatable Models
            </Typography>
            <Typography component="p">
              Here you will find models stored on a blockchain that you can interact with.
              Models are added to this list if you have recorded them on your device in this browser
              {serviceStorageEnabled ? " or if they are listed on a centralized database" : ""}.
            </Typography>
            <Typography component="p">
              You can deploy your own model <Link href='/addModel'>here</Link> or use an already deployed model by filling in the information <Link href='/addDeployedModel'>here</Link>.
            </Typography>
          </div>
          {this.state.loadingModels ?
            <div className={this.props.classes.spinnerDiv}>
              <CircularProgress size={100} />
            </div>
            : listItems.length > 0 ?
              <div className={this.props.classes.listDiv}>
                {this.state.numModelsRemaining > 0 &&
                  <div className={this.props.classes.nextButtonContainer}>
                    <Button className={this.props.classes.button} variant="outlined" color="primary"
                      onClick={this.nextModels}
                    >
                      Next
                    </Button>
                  </div>
                }
                <Paper>
                  <List className={this.props.classes.list}>
                    {listItems}
                  </List>
                </Paper>
                {this.state.numModelsRemaining > 0 &&
                  <div className={this.props.classes.nextButtonContainer}>
                    <Button className={this.props.classes.button} variant="outlined" color="primary"
                      onClick={this.nextModels}
                    >
                      Next
                    </Button>
                  </div>
                }
              </div>
              :
              <div className={this.props.classes.descriptionDiv}>
                <Typography component="p">
                  You do not have any models listed.
                </Typography>
              </div>
          }
        </Container>
      </div>
    );
  }
}

ModelList.propTypes = {
  classes: PropTypes.object.isRequired,
};

export default withSnackbar(withStyles(styles)(ModelList));
