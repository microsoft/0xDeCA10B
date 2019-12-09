import AppBar from '@material-ui/core/AppBar';
import Button from '@material-ui/core/Button';
import { withStyles } from '@material-ui/core/styles';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import AddIcon from '@material-ui/icons/Add';
import HomeIcon from '@material-ui/icons/Home';
import InfoIcon from '@material-ui/icons/Info';
import PropTypes from 'prop-types';
import React from 'react';
import { Link } from "react-router-dom";
import logoImg from '../images/logo_transparent_100x73.png';

const styles = {
  root: {
    flexGrow: 1,
  },
  flex: {
    flex: 1,
  },
  menuButton: {
    marginLeft: -12,
    marginRight: 20,
  },
  logoContainer: {
    marginTop: 10,
  },
  logo: {
    width: 85,
  }
};

class CustomAppBar extends React.Component {
  render() {
    const { classes } = this.props
    return (
      <div className={classes.root}>
        <AppBar position="static" color="default">
          <Toolbar>
            <div className={classes.logoContainer}>
              <Link to='/'>
                <img className={classes.logo} id="logo" alt="Logo" src={logoImg} />
              </Link>
            </div>
            <Typography variant="h6" color="inherit" className={classes.flex}>
            </Typography>
            <Link title="About this site" to='/about'>
              <Button className={classes.button}>
                <InfoIcon />
              </Button>
            </Link>
            <Link title="Add a new model" to='/add'>
              <Button className={classes.button}>
                <AddIcon />
              </Button>
            </Link>
            <Link title="Go to the home page" to='/'>
              <Button className={classes.button}>
                <HomeIcon />
              </Button>
            </Link>
          </Toolbar>
        </AppBar>
      </div>
    );
  }
}

CustomAppBar.propTypes = {
  classes: PropTypes.object.isRequired,
};

export default withStyles(styles)(CustomAppBar);