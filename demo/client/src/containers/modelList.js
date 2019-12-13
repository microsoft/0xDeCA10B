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
import { OnlineSafetyValidator } from '../safety/validator';
import { DataStoreFactory } from '../storage/data-store-factory';
import { getWeb3 } from '../getWeb3';

const styles = theme => ({
  link: {
    color: theme.palette.primary.main,
  }
});

class ModelList extends React.Component {
  constructor(props) {
    super(props);

    this.storages = DataStoreFactory.getAll()

    this.state = {
      models: [],
    }
  }

  componentDidMount = async () => {
    const web3 = await getWeb3()
    const networkType = await web3.eth.net.getNetworkType()
    const validator = new OnlineSafetyValidator()
    checkStorages(this.storages).then(permittedStorageTypes => {
      permittedStorageTypes.filter(storageType => storageType !== undefined)
        .forEach(storageType => {
          return this.storages[storageType].getModels().then(newModels => {
            newModels.forEach(model => {
              model.restrictContent = !validator.isPermitted(networkType, model.address)
            })
            this.setState(prevState => ({ models: prevState.models.concat(newModels) }))
          }).catch(err => {
            this.notify(`Could not get ${storageType} models`, { variant: 'error' })
            console.error(`Could not get ${storageType} models.`)
            console.error(err)
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
        <Paper>
          <List component="nav" className={this.props.classes.list}>
            {listItems ? listItems :
              <Typography component="p">
                There are currently no models available.
            </Typography>
            }
          </List>
        </Paper>
      </Container>
    );
  }
}

ModelList.propTypes = {
  classes: PropTypes.object.isRequired,
};

export default withSnackbar(withStyles(styles)(ModelList));
