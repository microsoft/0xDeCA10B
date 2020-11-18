import Container from '@material-ui/core/Container'
import Link from '@material-ui/core/Link'
import { withStyles } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography'
import React from 'react'
import { version } from '../../package.json'
import { OnlineSafetyValidator } from '../safety/validator'

const styles = theme => ({
  sectionTitle: {
    marginTop: theme.spacing(1),
  },
  section: {
    textAlign: 'left',
    marginTop: theme.spacing(1),
  },
})

class About extends React.Component {
  validator = new OnlineSafetyValidator()

  render() {
    const name = "Sharing Updatable Models"
    const { classes } = this.props
    return (<Container maxWidth="lg">
      <Typography variant="h4" component="h4">
        {name}
      </Typography>
      <Typography className={classes.sectionTitle} variant="h5" component="h5">
        <Link color='inherit' href='#disclaimers' name='disclaimers'>Disclaimers</Link>
      </Typography>
      <Typography className={classes.section} component="p">
        ⚠ WARNING When you upload a model or data to train a model, that data is most likely added to a version of a third party <Link href='https://ethereum.org/' target='_blank'>Ethereum</Link> blockchain network not controlled by Microsoft.
        Unless explicitly indicated, your data is not stored on Microsoft controlled machines.
        Your internet browser allows you to create transactions directly with a blockchain you have chosen through your browser or a browser extension like <Link href='https://metamask.io/' target='_blank'>MetaMask</Link>.
        Microsoft has no control over these transactions since the request is never sent to Microsoft machines before being sent from your browser directly to the blockchain network.
      </Typography>
      <Typography className={classes.section} component="p">
        If you have not changed the default blockchain network in your browser's or extension's settings, then it is likely set to use the public Ethereum mainnet.
        Microsoft does not fully endorse nor support the use of the mainnet or any other third party network because all information in it is public and might be difficult to completely delete.
      </Typography>
      <Typography className={classes.sectionTitle} variant="h5" component="h5">
        <Link color='inherit' href='#project' name='project'>About This Project</Link>
      </Typography>
      <Typography className={classes.section} component="p">
        The goal of this project is to promote sharing machine learning models at a greater scale.
        To achieve this, models are stored on a blockchain and so that people can update the models by providing their own data to smart contracts which train the model.
        Since this project could involve interacting with public blockchains, it is strongly encouraged that personal data is not used when interacting with models.
        This project is meant to be a proof of concept.
        For greater privacy and control over data, a private and permissioned chain can be used by trusted collaborators.
        An overview of the project can be found in our <Link href='https://aka.ms/0xDeCA10B-blog1' target="_blank">blog post</Link>.
      </Typography>
      {this.validator.isEnabled() && <div>
        <Typography className={classes.sectionTitle} variant="h5" component="h5">
          <Link color='inherit' href='#online-safety' name='online-safety'>Online Safety</Link>
        </Typography>
        <Typography className={classes.section} component="p">
          Special precautions have been enabled to stop unvalidated text from showing in this platform.
          You may notice that model names, descriptions, data, classifications, or other text fields might be hidden.
      </Typography>
      </div>}
      <Typography className={classes.sectionTitle} variant="h5" component="h5">
        <Link color='inherit' href='#code-of-conduct' name='code-of-conduct'>Code of Conduct</Link>
      </Typography>
      <Typography className={classes.section} component="p">
        The <Link href='https://go.microsoft.com/fwlink/?LinkID=246338' target='_blank'>Code of Conduct</Link> for Microsoft should be followed.
      </Typography>
      <Typography className={classes.section} component="p">
        Usually the blockchain you will select is public, therefore all data uploaded for training is effectively public.
        We encourage you not to upload nor use data with personal information.
        In our example smart contracts, getting predictions from models when you give data should not save the data to a public blockchain.
        You can tell if an action you take is saving data beyond your control because your browser should pop-up a notification asking you to confirm the transaction using something like <Link href='https://metamask.io/' target='_blank' rel="noopener">MetaMask</Link>.
      </Typography>
      <Typography className={classes.sectionTitle} variant="h5" component="h5">
        <Link color='inherit' href='#learn-more' name='learn-more'>Learn More</Link>
      </Typography>
      <Typography className={classes.section} component="p">
        The source code for this project can be found <Link href='https://aka.ms/0xDeCA10B' target="_blank">here</Link>.
        We also have a <Link href='https://aka.ms/0xDeCA10B-blog1' target="_blank">blog post</Link> explaining the purpose of this project.
      </Typography>
      <Typography className={classes.sectionTitle} variant="h5" component="h5">
        <Link color='inherit' href='#learn-more' name='learn-more'>Version</Link>
      </Typography>
      <Typography className={classes.section} component="p">
        {version}
      </Typography>
    </Container >)
  }
}

export default withStyles(styles)(About)