import Container from '@material-ui/core/Container';
import Divider from '@material-ui/core/Divider';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import Paper from '@material-ui/core/Paper';
import { withStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import PropTypes from 'prop-types';
import React from 'react';
import { Link } from "react-router-dom";
import { DataStoreFactory, DataStoreType } from '../storage/data-store-factory';

const styles = theme => ({
  link: {
    color: theme.palette.primary.main,
  }
});

class ModelList extends React.Component {
  constructor(props) {
    super(props);

    this.storageFactory = new DataStoreFactory();
    // Set up a default storage.
    this.storage = this.storageFactory.create(DataStoreType.SERVICE);

    this.state = {
    }
  }

  componentDidMount() {
    this.storage.getModels().then(models => {
      this.setState({ models });
    });
  }

  render() {
    let listItems = [];
    if (this.state.models) {
      listItems = this.state.models.map(m => {
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
          <div key={`model-${key}`}>
            <Link to={url}>
              <ListItem button>
                <ListItemText primary={m.name}
                  primaryTypographyProps={{ className: this.props.classes.link }}
                  secondary={m.accuracy && (m.accuracy * 100).toFixed(1) + "%"} />
              </ListItem>
            </Link>
            <Divider />
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

export default withStyles(styles)(ModelList);
