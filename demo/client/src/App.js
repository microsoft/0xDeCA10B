import blue from '@material-ui/core/colors/blue';
import CssBaseline from '@material-ui/core/CssBaseline';
import { createMuiTheme } from '@material-ui/core/styles';
import { ThemeProvider } from '@material-ui/styles';
import { SnackbarProvider } from 'notistack';
import React, { Component } from 'react';
import { BrowserRouter as Router, Route } from 'react-router-dom';
import About from './components/About';
import AddModel from './components/addModel';
import AppBar from './components/appBar';
import Model from './components/model';
import ModelList from './containers/modelList';
import Footer from './Footer';

const theme = createMuiTheme({
  palette: {
    primary: {
      // Use a lighter color for better contrast and accessibility.
      main: blue[300]
    },
    type: 'dark',
  },
  typography: {
    useNextVariants: true,
  },
});

class App extends Component {
  render() {
    const mainDiv = {
      marginTop: '50px'
    };
    const page = {
      position: 'relative',
      minHeight: '100vh',
    }
    const contentWrap = {
      // Pad enough for the footer height.
      paddingBottom: '18rem',
    }

    return (
      <Router>
        <ThemeProvider theme={theme}>
          <SnackbarProvider maxSnack={5}>
            <CssBaseline />
            <div className="App" style={page}>
              <div className="content-wrap" style={contentWrap}>
                <div className="App-header">
                  <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Roboto:300,400,500" />
                  <link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons" />
                  <AppBar />
                </div>
                <div style={mainDiv}>
                  <Route exact path="/" component={ModelList} />
                  <Route path="/about" component={About} />
                  <Route path="/add" component={AddModel} />
                  {/* TODO Create a page for adding a deployed model. */}
                  <Route path="/addDeployed" component={AddModel} />
                  <Route path="/model" component={Model} />
                </div>
              </div>
              <Footer />
            </div>
          </SnackbarProvider>
        </ThemeProvider>
      </Router>
    );
  }
}

export default App;
