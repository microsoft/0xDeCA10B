import AppBar from '@material-ui/core/AppBar';
import Button from '@material-ui/core/Button';
import Drawer from '@material-ui/core/Drawer';
import Hidden from '@material-ui/core/Hidden';
import IconButton from '@material-ui/core/IconButton';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import { withStyles } from '@material-ui/core/styles';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import AddIcon from '@material-ui/icons/Add';
import HomeIcon from '@material-ui/icons/Home';
import InfoIcon from '@material-ui/icons/Info';
import MenuIcon from '@material-ui/icons/Menu';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import React from 'react';
import { Link } from 'react-router-dom';
import logoImg from '../images/logo_transparent_100x73.png';

const drawerWidth = 220;

const styles = theme => ({
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
  },
  drawer: {
    width: drawerWidth,
    flexShrink: 0,
  },
  drawerPaper: {
    width: drawerWidth,
  },
  drawerHeader: {
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(0, 1),
    ...theme.mixins.toolbar,
    // To keep the icon on the right/end:
    // justifyContent: 'flex-end',
  },
  hide: {
    display: 'none',
  },
});

class CustomAppBar extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      isDrawerOpen: false,
    }

    this.handleDrawerOpen = this.handleDrawerOpen.bind(this)
    this.handleDrawerClose = this.handleDrawerClose.bind(this)
  }

  handleDrawerOpen() {
    this.setState({ isDrawerOpen: true })
  }

  handleDrawerClose() {
    this.setState({ isDrawerOpen: false })
  }

  render() {
    const { classes } = this.props
    return (
      <div className={classes.root}>
        <AppBar position="static" color="default">
          <Toolbar>
            <Hidden smUp>
              <IconButton
                color="inherit"
                title="Open drawer"
                aria-label="Open drawer"
                onClick={this.handleDrawerOpen}
                edge="start"
                className={clsx(classes.menuButton, this.state.isDrawerOpen && classes.hide)}
              >
                <MenuIcon />
              </IconButton>
            </Hidden>
            <div className={classes.logoContainer}>
              <Link to='/'>
                <img className={classes.logo} id="logo" alt="Logo" src={logoImg} />
              </Link>
            </div>
            {/* A title can go here. Removing it breaks right aligning the links.
            There's probably a better way to set up the aligning but I didn't want to bother because it was tricky and we might add a title back. */}
            <Typography variant="h6" color="inherit" className={classes.flex}></Typography>
            <Hidden xsDown>
              <Link title="Add a new model" to='/add'>
                <Button className={classes.button}>
                  <AddIcon />&nbsp;Add a model
              </Button>
              </Link>
              <Link title="About this site" to='/about'>
                <Button className={classes.button}>
                  <InfoIcon />&nbsp;ABOUT
              </Button>
              </Link>
              <Link title="Go to the home page" to='/'>
                <Button className={classes.button}>
                  <HomeIcon /> Home
              </Button>
              </Link>
            </Hidden>
          </Toolbar>
        </AppBar>
        <Drawer
          className={classes.drawer}
          variant="persistent"
          anchor="left"
          open={this.state.isDrawerOpen}
          classes={{
            paper: classes.drawerPaper,
          }}
        >
          <div className={classes.drawerHeader}>
            <IconButton onClick={this.handleDrawerClose}>
              <MenuIcon />
            </IconButton>
          </div>
          <List>
            <ListItem button component={Link} to='/' onClick={this.handleDrawerClose}>
              <ListItemIcon><HomeIcon /></ListItemIcon>
              <ListItemText primary="HOME" />
            </ListItem>
            <ListItem button component={Link} to='/about' onClick={this.handleDrawerClose}>
              <ListItemIcon><InfoIcon /></ListItemIcon>
              <ListItemText primary="ABOUT" />
            </ListItem>
            <ListItem button component={Link} to='/add' onClick={this.handleDrawerClose}>
              <ListItemIcon><AddIcon /></ListItemIcon>
              <ListItemText primary="ADD A MODEL" />
            </ListItem>
          </List>
        </Drawer>
      </div>
    );
  }
}

CustomAppBar.propTypes = {
  classes: PropTypes.object.isRequired,
};

export default withStyles(styles)(CustomAppBar);