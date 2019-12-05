import { CssBaseline } from '@material-ui/core';
import blue from '@material-ui/core/colors/blue';
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
    primary: blue,
    type: 'dark',
  },
  typography: {
    useNextVariants: true,
  },
});

class App extends Component {
  render() {
    const mainDiv = {
      'marginTop': '50px'
    };

    return (
      <Router>
        <ThemeProvider theme={theme}>
          <SnackbarProvider maxSnack={5}>
            <CssBaseline />
            <div className="App">
              <div className="App-header">
                <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Roboto:300,400,500" />
                <link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons" />
                <AppBar />
              </div>
              <div style={mainDiv}>
                <Route exact path="/" component={ModelList} />
                <Route path="/about" component={About} />
                <Route path="/add" component={AddModel} />
                <Route path="/model" component={Model} />
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
