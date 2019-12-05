import { Link, Typography } from '@material-ui/core';
import { withStyles } from '@material-ui/core/styles';
import React from 'react';

const styles = theme => ({
  footer: {
    backgroundColor: theme.palette.background.paper,
    padding: theme.spacing(6),
    position: 'absolute',
    left: 0,
    bottom: 0,
    right: 0,
  },
});

class Footer extends React.Component {
  render() {
    const { classes } = this.props;
    return (
      <footer className={classes.footer}>
        <Typography variant="subtitle1" color="textSecondary" align="center">
          TODO WARNING About putting data on a public blockchain.
        </Typography>
        <Typography variant="body2" color="textSecondary" align="center">
          <Link to="https://go.microsoft.com/?linkid=2028325">Contact Us</Link>
          &nbsp;|&nbsp;
          <Link to="https://go.microsoft.com/fwlink/?LinkId=521839">{"Privacy & Cookies"}</Link>
          &nbsp;|&nbsp;
          <Link to="https://go.microsoft.com/fwlink/?LinkID=246338">Terms of Use</Link>
          &nbsp;|&nbsp;
          {/* Waiting for CELA to say if a Code of Conduct is needed. */}
          {/* <Link>Code of Conduct</Link>
          &nbsp;|&nbsp; */}
          <Link to="https://go.microsoft.com/fwlink/?LinkId=506942">Trademarks</Link>
          &nbsp;|&nbsp;
          © {new Date().getFullYear()} Microsoft
        </Typography>
        <Typography variant="body2" color="textSecondary" align="center">
          {/* TODO Microsoft logo */}
        </Typography>
      </footer>
    )
  }
}
export default withStyles(styles)(Footer);