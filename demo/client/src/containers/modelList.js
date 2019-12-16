import Button from '@material-ui/core/Button';
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
});

class ModelList extends React.Component {
  constructor(props) {
    super(props);

    this.storages = DataStoreFactory.getAll()
    this.storageAfterAddress = {}

    this.state = {
      models: [],
    }

    this.nextModels = this.nextModels.bind(this)
  }

  componentDidMount = async () => {
    const web3 = await getWeb3()
    this.networkType = await web3.eth.net.getNetworkType()
    this.validator = new OnlineSafetyValidator()
    checkStorages(this.storages).then(permittedStorageTypes => {
      permittedStorageTypes = permittedStorageTypes.filter(storageType => storageType !== undefined)
      this.setState({ permittedStorageTypes }, this.updateModels)
    })
  }

  notify(...args) {
    return this.props.enqueueSnackbar(...args);
  }

  dismissNotification(...args) {
    return this.props.closeSnackbar(...args);
  }

  nextModels() {
    this.setState({ models: [] }, this.updateModels)
  }

  updateModels() {
    // TODO Also get valid contracts that the account has already interacted with.
    // TODO Change to 10 before merging.
    const limit = 1
    this.state.permittedStorageTypes.forEach(storageType => {
      const afterId = this.storageAfterAddress[storageType]
      return this.storages[storageType].getModels(afterId, limit).then(newModels => {
        newModels.forEach(model => {
          model.restrictContent = !this.validator.isPermitted(this.networkType, model.address)
        })
        if (newModels.length > 0) {
          this.storageAfterAddress[storageType] = newModels[newModels.length - 1].address
        }
        this.setState(prevState => ({ models: prevState.models.concat(newModels) }))
      }).catch(err => {
        this.notify(`Could not get ${storageType} models`, { variant: 'error' })
        console.error(`Could not get ${storageType} models.`)
        console.error(err)
      })
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
        {/* TODO Only show if there are more models. */}
        <Button className={this.props.classes.button} variant="outlined" color="primary"
          onClick={this.nextModels}
        >
          Next
        </Button>
        <Paper>
          <List component="nav" className={this.props.classes.list}>
            {listItems ? listItems :
              <Typography component="p">
                There are currently no models available.
            </Typography>
            }
          </List>
        </Paper>
        {/* TODO Only show if there are more models. */}
        <Button className={this.props.classes.button} variant="outlined" color="primary"
          onClick={this.nextModels}
        >
          Next
        </Button>
      </Container>
    );
  }
}

ModelList.propTypes = {
  classes: PropTypes.object.isRequired,
};

export default withSnackbar(withStyles(styles)(ModelList));
