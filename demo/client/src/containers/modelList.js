import Divider from '@material-ui/core/Divider';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import { withStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import axios from 'axios';
import PropTypes from 'prop-types';
import React from 'react';
import { Link } from "react-router-dom";

const styles = theme => ({
  root: {
    width: '65%',
    marginTop: theme.spacing.unit * 3,
    overflowX: 'auto',
  },
  table: {
    minWidth: 700,
  }
});

class ModelList extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
    }
  }
  componentDidMount() {
    axios.get('/api/models').then(r => {
      this.setState({ models: r.data.models });
    }).catch(console.error);
  }

  render() {
    let listItems = [];
    if (this.state.models) {
      listItems = this.state.models.map(m => {
        return (
          <div key={`model-${m.id}`}>
            <Link to={`/model?modelId=${m.id}&tab=predict`}>
              <ListItem button>
                <ListItemText primary={m.name} secondary={(m.accuracy * 100).toFixed(1) + "%"} />
              </ListItem>
            </Link>
            <Divider />
          </div>
        );
      });
    }

    return (
      <List component="nav" className={this.props.classes.list}>
        {listItems ? listItems :
          <Typography component="p">
            There are currently no models available.
        </Typography>
        }
      </List>
    );
  }
}

ModelList.propTypes = {
  classes: PropTypes.object.isRequired,
};

export default withStyles(styles)(ModelList);
