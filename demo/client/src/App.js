import { CssBaseline } from '@material-ui/core';
import blue from '@material-ui/core/colors/blue';
import { createMuiTheme } from '@material-ui/core/styles';
import MuiThemeProvider from '@material-ui/core/styles/MuiThemeProvider';
import React, { Component } from 'react';
import { BrowserRouter as Router, Route } from "react-router-dom";
import AddModel from './components/addModel';
import AppBar from './components/appBar';
import Model from './components/model';
import ModelList from './containers/modelList';

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
      'width': '50%',
      'marginLeft': '25%',
      'marginTop': '50px'
    };

    return (
      <Router>
        <MuiThemeProvider theme={theme}>
          <CssBaseline />
          <div className="App">
            <div className="App-header">
              <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Roboto:300,400,500" />
              <link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons" />
              <AppBar />
            </div>
            <div>
              <div style={mainDiv}>
                <Route exact path="/" component={ModelList} />
                <Route path="/model" component={Model} />
                <Route path="/add" component={AddModel} />
              </div>
            </div>
          </div>
        </MuiThemeProvider>
      </Router>
    );
  }
}

export default App;
