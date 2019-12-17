import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import Container from '@material-ui/core/Container';
import Divider from '@material-ui/core/Divider';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import Paper from '@material-ui/core/Paper';
import { withStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import { withSnackbar } from 'notistack';
import PropTypes from 'prop-types';
import React from 'react';
import { Link } from "react-router-dom";
import { checkStorages } from '../components/storageSelector';
import { getWeb3 } from '../getWeb3';
import { OnlineSafetyValidator } from '../safety/validator';
import { DataStoreFactory } from '../storage/data-store-factory';

const styles = theme => ({
  link: {
    color: theme.palette.primary.main,
  },
  button: {
    marginTop: 20,
    marginBottom: 20,
  },
  spinnerContainer: {
    textAlign: 'center',
  },
  nextButtonContainer: {
    textAlign: 'end',
  }
});

class ModelList extends React.Component {
  constructor(props) {
    super(props);

    this.storages = DataStoreFactory.getAll()
    this.storageAfterAddress = {}

    this.state = {
      loadingModels: true,
      numModelsRemaining: 0,
      models: [],
    }

    this.nextModels = this.nextModels.bind(this)
  }

  componentDidMount = async () => {
    const web3 = await getWeb3()
    this.validator = new OnlineSafetyValidator()
    this.networkType = await web3.eth.net.getNetworkType()
    checkStorages(this.storages).then(permittedStorageTypes => {
      permittedStorageTypes = permittedStorageTypes.filter(storageType => storageType !== undefined)
      this.setState({ permittedStorageTypes }, this.updateModels)
    })
    if (typeof window !== "undefined" && window.ethereum) {
      window.ethereum.on('accountsChanged', _ => {
        window.location.reload()
      });
      window.ethereum.on('networkChanged', _ => {
        window.location.reload()
      })
    }
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

  updateModels() {
    // TODO Also get valid contracts that the account has already interacted with.
    const limit = 6
    Promise.all(this.state.permittedStorageTypes.map(storageType => {
      const afterId = this.storageAfterAddress[storageType]
      return this.storages[storageType].getModels(afterId, limit).then(response => {
        const newModels = response.models
        const { remaining } = response
        newModels.forEach(model => {
          model.restrictContent = !this.validator.isPermitted(this.networkType, model.address)
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

  render() {
    let listItems = [];
    if (this.state.models) {
      listItems = this.state.models.map((m, index) => {
        let key, keyName;
        if (m.id) {
          key = m.id;
          keyName = 'modelId';
        } else {
          key = m.address;
          keyName = 'address'
        }
        const url = `/model?${keyName}=${key}&tab=predict`;
        return (
          <div key={`model-${index}`}>
            <Link to={url}>
              <ListItem button>
                <ListItemText primary={m.restrictContent ? `(name hidden) Address: ${m.address}` : m.name}
                  primaryTypographyProps={{ className: this.props.classes.link }}
                  secondary={m.accuracy && `Accuracy: ${(m.accuracy * 100).toFixed(1)}%`} />
              </ListItem>
            </Link>
            {index + 1 !== this.state.models.length && <Divider />}
          </div>
        );
      });
    }

    return (
      <Container>
        {this.state.loadingModels ?
          <div className={this.props.classes.spinnerContainer}>
            <CircularProgress size={100} />
          </div>
          : listItems.length > 0 ?
            <div>
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
                <List component="nav" className={this.props.classes.list}>
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
            : <Typography component="p">
              No models found.
            </Typography>
        }
      </Container>
    );
  }
}

ModelList.propTypes = {
  classes: PropTypes.object.isRequired,
};

export default withSnackbar(withStyles(styles)(ModelList));
