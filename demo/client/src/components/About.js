import { Container, Typography } from '@material-ui/core';
import { withStyles } from '@material-ui/core/styles';
import React from 'react';

const styles = theme => ({
  aboutDescription: {
    textAlign: 'left',
    marginTop: 10,
  },
});

class About extends React.Component {
  render() {
    const { classes } = this.props
    return (<Container maxWidth="lg">
      <Typography variant="h6" component="h6" color="textSecondary">
        TODO Title
      </Typography>
      <Typography className={classes.aboutDescription} component="p">
        TODO
      </Typography>
    </Container>);
  }
}

export default withStyles(styles)(About);