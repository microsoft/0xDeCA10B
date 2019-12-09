import { Container, Link, Typography } from '@material-ui/core';
import { withStyles } from '@material-ui/core/styles';
import React from 'react';

const styles = theme => ({
  sectionTitle: {
    marginTop: theme.spacing(1),
  },
  section: {
    textAlign: 'left',
    marginTop: theme.spacing(1),
  },
});

class About extends React.Component {
  render() {
    const name = "Sharing Updatable Models"
    const { classes } = this.props
    return (<Container maxWidth="lg">
      <Typography variant="h4" component="h4" color="textSecondary">
        {name}
      </Typography>
      <Typography className={classes.section} component="p">
        ⚠ WARNING When you upload a model or data to train a model, that data is added to a public blockchain not controlled by Microsoft.
        Unless explicitly indicated, your data is not stored on Microsoft servers.
        Your internet browser allows you to create transactions directly with a public blockchain.
        Microsoft has no control over this transaction since the request is not sent to Microsoft servers before being sent directly to the blockchain by your browser.
      </Typography>
      <Typography className={classes.sectionTitle} variant="h6" component="h6" color="textSecondary">
        Learn More
      </Typography>
      <Typography className={classes.section} component="p">
        The source code for this project can be found <Link href='https://aka.ms/0xDeCA10B' target="_blank">here</Link>.
        There is also a <Link href='https://aka.ms/0xDeCA10B-blog1' target="_blank">blog post</Link> explaining the purpose of this project.
      </Typography>
    </Container>);
  }
}

export default withStyles(styles)(About);