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
        Unless explicitly indicated, your data is not stored on Microsoft controlled machines.
        Your internet browser allows you to create transactions directly with a public blockchain.
        Microsoft has no control over these transaction since the request is not sent to Microsoft machines before being sent directly to the blockchain by your browser.
      </Typography>
      <Typography className={classes.sectionTitle} variant="h5" component="h5" color="textSecondary">
        <Link color='inherit' href='#code-of-conduct' name='code-of-conduct'>Code of Conduct</Link>
      </Typography>
      <Typography className={classes.section} component="p">
        The <Link href='https://go.microsoft.com/fwlink/?LinkID=246338' target='_blank'>Code of Conduct</Link> for Microsoft should be followed.
      </Typography>
      <Typography className={classes.section} component="p">
        Since all data uploaded for training is effectively public, we encourage you not to upload data with personal information.
        In our example smart contracts, getting predictions from models when you give data should not save the data to a public blockchain.
        You can tell if an action you take is saving data to a public blockchain because your browser should pop-up a notification asking you to confirm the transaction using something like <Link href='https://metamask.io/' target='_blank' rel="noopener">MetaMask</Link>.
      </Typography>
      <Typography className={classes.sectionTitle} variant="h5" component="h5" color="textSecondary">
        Learn More
      </Typography>
      <Typography className={classes.section} component="p">
        The source code for this project can be found <Link href='https://aka.ms/0xDeCA10B' target="_blank">here</Link>.
        We also have a <Link href='https://aka.ms/0xDeCA10B-blog1' target="_blank">blog post</Link> explaining the purpose of this project.
      </Typography>
    </Container >);
  }
}

export default withStyles(styles)(About);