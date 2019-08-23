import getWeb3 from "@drizzle-utils/get-web3";
import AppBar from '@material-ui/core/AppBar';
import Button from '@material-ui/core/Button';
import InputLabel from '@material-ui/core/InputLabel';
import MenuItem from '@material-ui/core/MenuItem';
import Paper from '@material-ui/core/Paper';
import Select from '@material-ui/core/Select';
import { withStyles } from '@material-ui/core/styles';
import Tab from '@material-ui/core/Tab';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Tabs from '@material-ui/core/Tabs';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import * as mobilenet from '@tensorflow-models/mobilenet';
import * as UniversalSentenceEncoder from '@tensorflow-models/universal-sentence-encoder';
import axios from 'axios';
import loadImage from 'blueimp-load-image';
import update from 'immutability-helper';
import moment from 'moment';
import PropTypes from 'prop-types';
import React from 'react';
import Dropzone from 'react-dropzone';
import Web3 from "web3"; // Only required for custom/fallback provider option.
import Classifier from "../contracts/Classifier64.json";
import CollaborativeTrainer from '../contracts/CollaborativeTrainer64.json';
import DataHandler from '../contracts/DataHandler64.json';
import IncentiveMechanism from '../contracts/Stakeable64.json';
import ImdbVocab from '../data/imdb.json';

moment.relativeTimeThreshold('ss', 4);

const styles = theme => ({
  root: {
    ...theme.mixins.gutters(),
    paddingTop: theme.spacing.unit * 2,
    paddingBottom: theme.spacing.unit * 2,
    display: 'flex',
    flexDirection: 'column'
  },
  button: {
    marginTop: '20px'
  },
  tabContainer: {
    display: 'flex',
    flexDirection: 'column'
  },
  tabs: {
    marginTop: '30px'
  }
});

function TabContainer(props) {
  return (
    <Typography component="div" style={{ padding: 8 * 3 }}>
      {props.children}
    </Typography>
  );
}

// Checks if two training data samples are equal.
function areDataEqual(data1, data2) {
  if (data1 === data2) {
    return true;
  }
  if (typeof data1 !== typeof data2) {
    return false;
  }
  if (data1.length !== data2.length) {
    return false;
  }
  for (let i = 0; i < data1.length; ++i) {
    if (data1[i] !== data2[i]) {
      return false;
    }
  }
  return true;
}

function getDisplayableOriginalData(data) {
  if (typeof data === 'string') {
    return `"${data}"`;
  }
  return data;
}

class Model extends React.Component {
  REFUND_TAB = 2;
  REWARD_TAB = 3;

  TABS = [
    "predict",
    "train",
    "refund",
    "reward",
  ];

  constructor(props) {
    super(props);
    this.props = props;
    this.classes = props.classes;

    let tabIndex = 0;
    const currentUrlParams = new URLSearchParams(window.location.search);
    const tab = currentUrlParams.get('tab');
    if (tab) {
      tabIndex = this.TABS.indexOf(tab);
      if (tabIndex === -1) {
        tabIndex = 0;
      }
    }

    this.state = {
      contractInfo: {},
      modelId: currentUrlParams.get('modelId'),
      classifications: [],
      tab: tabIndex,
      addedData: [],
      rewardData: [],
      contractInstance: undefined,
      depositCost: undefined,
      trainData: undefined,
      trainClassIndex: 0,
      input: "[]",
      inputType: undefined,
      // inputImageUrl: "https://images.unsplash.com/photo-1518791841217-8f162f1e1131",
      // inputImageUrl: "https://hips.hearstapps.com/hmg-prod.s3.amazonaws.com/images/gettyimages-1094874726.png?crop=0.542xw:0.814xh;0.0472xw,0.127xh&resize=640:*",
      // inputImageUrl: "https://github.com/tensorflow/tfjs-models/blob/master/mobilenet/demo/coffee.jpg?raw=true",
      // inputImageUrl: "https://d17fnq9dkz9hgj.cloudfront.net/breed-uploads/2018/09/dog-landing-hero-lg.jpg?bust=1536935129&width=1080",
      // inputImageUrl: "https://leitesculinaria.com/wp-content/uploads/fly-images/96169/best-hot-dog-recipe-fi-400x225-c.jpg",
      // inputImageUrl: "https://www.ballparkbrand.com/sites/default/files/Hero_Dog_0.png",
      // inputImageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fb/Hotdog_-_Evan_Swigart.jpg/1200px-Hotdog_-_Evan_Swigart.jpg",
      // inputImageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/VitalikButerinProfile.jpg/250px-VitalikButerinProfile.jpg",
      inputImageUrl: "https://pbs.twimg.com/profile_images/877269203153072128/d9CDANz-_400x400.jpg",
      // inputImageUrl: "https://pbs.twimg.com/profile_images/977496875887558661/L86xyLF4_400x400.jpg",
      accounts: undefined,
      prediction: "",
      accountScore: undefined,
      numGood: undefined,
      toFloat: undefined,
      totalGoodDataCount: undefined
    }

    this.addDataCost = this.addDataCost.bind(this);
    this.canAttemptRefund = this.canAttemptRefund.bind(this);
    this.getContractInstance = this.getContractInstance.bind(this);
    this.getHumanReadableEth = this.getHumanReadableEth.bind(this);
    this.getSentiment = this.getSentiment.bind(this);
    this.handleInputChange = this.handleInputChange.bind(this);
    this.handleTabChange = this.handleTabChange.bind(this);
    this.hasEnoughTimePassed = this.hasEnoughTimePassed.bind(this);
    this.predict = this.predict.bind(this);
    this.predictInput = this.predictInput.bind(this);
    this.processUploadedImageInput = this.processUploadedImageInput.bind(this);
    this.refund = this.refund.bind(this);
    this.setContractInstance = this.setContractInstance.bind(this);
    this.takeDeposit = this.takeDeposit.bind(this);
    this.train = this.train.bind(this);
    this.updateDynamicAccountInfo = this.updateDynamicAccountInfo.bind(this);
    this.updateDynamicInfo = this.updateDynamicInfo.bind(this);
    this.updateRefundData = this.updateRefundData.bind(this);
    this.updateRewardData = this.updateRewardData.bind(this);
  }

  componentDidMount = async () => {
    try {
      const fallbackProvider = new Web3.providers.HttpProvider("http://127.0.0.1:7545");
      this.web3 = await getWeb3({ fallbackProvider, requestPermission: true });

      axios.get(`/api/models/${this.state.modelId}`).then(r => {
        this.setState({ contractInfo: r.data.model },
          async _ => {
            await this.setContractInstance();
            // TODO Add a toast and enable buttons.
            console.log("Ready for interactions.");
          });
      });
    } catch (error) {
      alert(`Failed to load web3, accounts, or contract. Check console for details.`);
      console.error(error);
    }
  }

  setContractInstance = async () => {
    const accounts = await this.web3.eth.getAccounts();

    let contractAddress = this.state.contractInfo.address || null;
    // Get the contract instance.
    if (contractAddress === null) {
      // To help with testing locally if the contract info is not stored in the database.
      const networkId = await this.web3.eth.net.getId();
      const deployedNetwork = CollaborativeTrainer.networks[networkId];
      contractAddress = deployedNetwork.address;
      console.warn(`Using found contract address: ${contractAddress}`);
    } else {
      // Use the contract address from the database and assume it conforms to the known interfaces.
      // TODO Get abi from https://etherscan.io/apis#contracts
    }

    const contractInstance = await this.getContractInstance({
      web3: this.web3,
      abi: CollaborativeTrainer.abi,
      address: contractAddress
    });
    const dataHandlerAddress = await contractInstance.methods.dataHandler().call();
    const dataHandler = await this.getContractInstance({
      web3: this.web3,
      abi: DataHandler.abi,
      address: dataHandlerAddress
    });
    const classifierAddress = await contractInstance.methods.classifier().call();

    let modelAbi;
    if (this.state.contractInfo.modelType === "Classifier64") {
      modelAbi = Classifier.abi;
    } else {
      // TODO Get abi from https://etherscan.io/apis#contracts
      alert("Couldn't determine model ABI.");
    }
    const classifier = await this.getContractInstance({
      web3: this.web3,
      abi: modelAbi,
      address: classifierAddress
    });
    const incentiveMechanismAddress = await contractInstance.methods.incentiveMechanism().call();
    const incentiveMechanism = await this.getContractInstance({
      web3: this.web3,
      abi: IncentiveMechanism.abi,
      address: incentiveMechanismAddress
    });
    await this.setState({ accounts, classifier, contractInstance, dataHandler, incentiveMechanism });
    const promises = await Promise.all([
      this.updateContractInfo(),
      this.updateDynamicInfo(),
      this.getTransformInputMethod(),
    ]);

    this.transformInput = promises[2].bind(this);

    if (this.state.tab !== 0) {
      this.handleTabChange(null, this.state.tab);
    }

    setInterval(this.updateDynamicInfo, 15 * 1000);
    if (typeof window !== "undefined" && window.ethereum) {
      window.ethereum.on('accountsChanged', accounts => {
        this.setState({ accounts, addedData: [], rewardData: [] }, _ => {
          this.updateDynamicAccountInfo().then(() => {
            if (this.state.tab !== 0) {
              this.handleTabChange(null, this.state.tab);
            }
          });
        });
      });
      window.ethereum.on('networkChanged', netId => {
        this.setContractInstance();
      });
    }
  }

  async getTransformInputMethod() {
    let transformInput;
    if (this.state.contractInfo.encoder === 'universal sentence encoder') {
      await this.setState({ inputType: 'text' });
      const use = await UniversalSentenceEncoder.load();
      transformInput = async (query) => {
        const toFloat = this.state.toFloat;
        const embeddings = await use.embed(query);
        const embedding = embeddings.gather(0).arraySync();
        const convertedEmbedding = embedding.map(x => Math.round(x * toFloat));
        return this.state.classifier.methods.norm(convertedEmbedding.map(v => this.web3.utils.toHex(v))).call()
          .then(parseInt)
          .then(norm => {
            norm = this.web3.utils.toBN(norm);
            const _toFloat = this.web3.utils.toBN(toFloat);
            return convertedEmbedding.map(v => this.web3.utils.toBN(v).mul(_toFloat).div(norm))
              .map(x => this.web3.utils.toHex(x.toNumber()));
          });
      };
    } else if (this.state.contractInfo.encoder === 'MobileNetv2') {
      await this.setState({ inputType: 'image' });
      // https://github.com/tensorflow/tfjs-models/tree/master/mobilenet
      const model = await mobilenet.load(
        {
          version: 2,
          alpha: 1,
        }
      );
      transformInput = async (imgElement) => {
        const toFloat = this.state.toFloat;
        let imgEmbedding = await model.infer(imgElement, { embedding: true });
        const emb = imgEmbedding.arraySync()[0];
        imgEmbedding.dispose();
        const convertedEmbedding = emb.map(x => Math.round(x * toFloat));
        // FIXME normalize.
        return convertedEmbedding.map(v => this.web3.utils.toHex(v));
      }
    } else if (this.state.contractInfo.encoder === 'IMDB vocab') {
      await this.setState({ inputType: 'text' });
      this.vocab = [];
      Object.entries(ImdbVocab).forEach(([key, value]) => {
        this.vocab[value] = key;
      });
      transformInput = async (query) => {
        const tokens = query.toLowerCase().split(" ");
        return tokens.map(t => {
          let idx = ImdbVocab[t];
          if (idx === undefined) {
            // TOOD Add to vocab.
            return 1337;
          }
          return idx;
        }).map(v => this.web3.utils.toHex(v));
      };
    } else {
      throw new Error(`Couldn't find encoder for ${this.state.contractInfo.encoder}`);
    }
    return transformInput;
  }

  addDataCost() {
    const now = Math.floor(new Date().getTime() / 1000);
    return this.state.incentiveMechanism.methods.getNextAddDataCost(now).call()
      .then(parseInt);
  }

  canAttemptRefund(data, isForTaking, cb) {
    var canAttemptRefund = false;
    var claimer = this.state.accounts[0];
    if (isForTaking && (this.state.numGood === 0 || this.state.numGood === undefined)) {
      cb({ canAttemptRefund });
      return;
    }
    // TODO Duplicate more of the contract's logic here.
    const dataSample = data.data;
    // This will help with giving better error messages and avoid trying to create new transactions.
    this.state.dataHandler.methods.hasClaimed(dataSample, data.classification, data.time, data.sender, claimer).call()
      .then(hasClaimed => {
        if (hasClaimed) {
          canAttemptRefund = false;
          cb({ canAttemptRefund });
          return;
        }
        this.state.dataHandler.methods.getClaimableAmount(dataSample, data.classification, data.time, data.sender).call()
          .then(parseInt)
          .then(claimableAmount => {
            if (claimableAmount <= 0) {
              canAttemptRefund = false;
              cb({ canAttemptRefund, claimableAmount });
            } else {
              this.predict(dataSample).then(prediction => {
                if (isForTaking) {
                  // Prediction must be wrong.
                  canAttemptRefund = prediction !== data.classification;
                  // Take the floor since that is what Solidity will do.      
                  var amountShouldGet = Math.floor(data.initialDeposit * this.state.numGood / this.state.totalGoodDataCount);
                  if (amountShouldGet !== 0) {
                    claimableAmount = amountShouldGet;
                  }
                } else {
                  canAttemptRefund = prediction === data.classification;
                }
                cb({ canAttemptRefund, claimableAmount, prediction });
              });
            }
          });
      }).catch(err => {
        console.error(err);
        canAttemptRefund = false;
        cb({ canAttemptRefund, err });
      });
  }

  getContractInstance(options) {
    return new Promise(async (resolve, reject) => {
      try {
        const instance = new options.web3.eth.Contract(options.abi, options.address);
        return resolve(instance);
      } catch (err) {
        return reject(err);
      }
    });
  }

  getDisplayableEncodedData(data) {
    let d = data.map(v => this.web3.utils.toBN(v).toNumber());
    const divideFloatList = ['MobileNetv2', 'universal sentence encoder'];
    if (divideFloatList.indexOf(this.state.contractInfo.encoder) > -1) {
      const _toFloat = this.state.toFloat;
      d = d.map(v => v / _toFloat);
    }
    let result = JSON.stringify(d);
    if (result.length > 110) {
      result = result.slice(0, 100) + "...";
    }
    return result;
  }

  getHumanReadableEth(amount) {
    // Could use web3.fromWei but it returns a string and then truncating would be trickier/less efficient.
    return `Ξ${(amount * 1E-18).toFixed(6)}`;
  }

  // Returns a Promise.
  getOriginalData(transactionHash) {
    return axios.get(`/api/data/${transactionHash}`).then(r => {
      return r.data.originalData;
    });
  }

  getSentiment(val) {
    if (typeof val !== 'number' || val < 0 || val >= this.state.classifications.length) {
      return val;
    }
    try {
      return this.state.classifications[val];
    } catch (error) {
      return val;
    }
  }

  handleAddedData(account = null, cb) {
    // Doesn't actually work well when passing an account and filtering on it.
    // It might have something to do with MetaMask (according to some posts online).
    // It could also be because of casing in addresses.
    return this.state.contractInstance.getPastEvents('AddData', { filter: { sender: account }, fromBlock: 0, toBlock: 'latest' }).then(results => {
      results.forEach(r => {
        if (account === null || account === r.returnValues.sender) {
          cb(r);
        }
      });
    });
  }

  handleInputChange(event) {
    const target = event.target;
    const value = target.type === "checkbox" ? target.checked : target.value;
    const name = target.name;
    this.setState({
      [name]: value
    });
  }

  handleTabChange(_, value) {
    const tab = this.TABS[value];

    // Change URL.
    const currentUrlParams = new URLSearchParams(window.location.search);
    currentUrlParams.set('tab', tab);
    this.props.history.push(window.location.pathname + "?" + currentUrlParams.toString())
    this.setState({ tab: value });
    if (this.REFUND_TAB === value) {
      if (this.state.addedData.length === 0) {
        this.updateRefundData();
      }
    } else if (this.REWARD_TAB === value) {
      if (this.state.rewardData.length === 0) {
        this.updateRewardData();
      }
    }
  }

  hasEnoughTimePassed(data, waitThreshold) {
    // Add 2 seconds since it will take some time to confirm and send the transaction anyway.
    return 2 + new Date().getTime() / 1000 - data.time > waitThreshold;
  }

  updateContractInfo() {
    return Promise.all([
      this.state.classifier.methods.getNumClassifications().call()
        .then(parseInt)
        .then(numClassifications => {
          for (let i = 0; i < numClassifications; ++i) {
            this.state.classifier.methods.classifications(i).call()
              .then(classificationName => {
                this.setState({ classifications: update(this.state.classifications, { [i]: { $set: classificationName } }) });
              });
          }
        }),
      this.state.classifier.methods.toFloat().call()
        .then(parseInt)
        .then(toFloat => {
          this.setState({ toFloat });
        })
        .catch(err => {
          // It's probably fine to ignore since `toFloat` probably isn't needed.
          console.warn("Couldn't get toFloat value from classifier.");
          console.warn(err);
        }),
      this.state.incentiveMechanism.methods.ownerClaimWaitTimeS().call()
        .then(parseInt)
        .then(ownerClaimWaitTimeS => {
          this.setState({ ownerClaimWaitTimeS });
        }).catch(err => {
          console.error("Couldn't get ownerClaimWaitTimeS value from IM.");
          console.error(err);
        }),
      this.state.incentiveMechanism.methods.costWeight().call()
        .then(parseInt)
        .then(costWeight => {
          this.setState({ costWeight });
        }),
      this.state.incentiveMechanism.methods.refundWaitTimeS().call()
        .then(parseInt)
        .then(refundWaitTimeS => {
          this.setState({ refundWaitTimeS });
        })
    ]);
  }

  updateDynamicInfo() {
    return Promise.all([
      this.addDataCost()
        .then((depositCost) => {
          this.setState({ depositCost });
        }),
      this.updateDynamicAccountInfo()
    ]);
  }

  updateDynamicAccountInfo() {
    return this.state.incentiveMechanism.methods.numGoodDataPerAddress(this.state.accounts[0]).call()
      .then(parseInt)
      .then((numGood) => {
        if (numGood > 0) {
          this.state.incentiveMechanism.methods.totalGoodDataCount().call()
            .then(parseInt)
            .then((totalGoodDataCount) => {
              const accountScore = (100 * numGood / totalGoodDataCount).toFixed(2) + "%";
              this.setState({ accountScore, numGood, totalGoodDataCount });
            });
        } else if (this.state.accountScore !== undefined) {
          this.setState({ accountScore: undefined, numGood: undefined });
        }
      });
  }

  updateRefundData() {
    this.setState({ addedData: [] });
    const contributor = this.state.accounts[0];
    // Manually filter since it doesn't work well when specifying sender.
    return this.handleAddedData(null, d => {
      const sender = d.returnValues.sender;
      if (sender.toUpperCase() !== contributor.toUpperCase()) {
        return;
      }

      const data = d.returnValues.d.map(v => this.web3.utils.toHex(v));
      const classification = parseInt(d.returnValues.c);
      const time = parseInt(d.returnValues.t);
      const initialDeposit = parseInt(d.returnValues.cost);

      this.getOriginalData(d.transactionHash).then(originalData => {
        this.transformInput(originalData).then(encodedData => {
          const info = {
            data, classification, initialDeposit, sender, time,
            dataMatches: areDataEqual(data, encodedData),
            originalData: getDisplayableOriginalData(originalData),
          };

          info.hasEnoughTimePassed = this.hasEnoughTimePassed(info, this.state.refundWaitTimeS);
          this.canAttemptRefund(info, false, refundInfo => {
            const {
              canAttemptRefund = false,
              claimableAmount = null,
              err = null,
              prediction = null,
            } = refundInfo;
            if (err) {
              info.errorCheckingStatus = true;
            } else {
              info.canAttemptRefund = canAttemptRefund;
              info.claimableAmount = claimableAmount;
              info.prediction = prediction;
            }
            this.setState({
              addedData: [...this.state.addedData, info]
            });
          });
        });
      }).catch(err => {
        console.error(`Error getting original data for transactionHash: ${d.transactionHash}`);
        console.error(err);
      });
    });
  }

  updateRewardData() {
    this.setState({ rewardData: [] });
    const account = this.state.accounts[0];
    this.handleAddedData(null, d => {
      const sender = d.returnValues.sender;
      if (sender.toUpperCase() === account.toUpperCase()) {
        // Can't claim a reward for your own data.
        return;
      }

      const data = d.returnValues.d.map(v => this.web3.utils.toHex(v));
      const classification = parseInt(d.returnValues.c);
      const time = parseInt(d.returnValues.t);
      const initialDeposit = parseInt(d.returnValues.cost);
      this.getOriginalData(d.transactionHash).then(originalData => {
        this.transformInput(originalData).then(encodedData => {
          const info = {
            data, classification, initialDeposit, sender, time,
            dataMatches: areDataEqual(data, encodedData),
            originalData: getDisplayableOriginalData(originalData),
          };
          info.hasEnoughTimePassed = this.hasEnoughTimePassed(info, this.state.refundWaitTimeS);
          this.canAttemptRefund(info, true, refundInfo => {
            const { canAttemptRefund = false,
              claimableAmount = null,
              err = null,
              prediction = null,
            } = refundInfo;
            if (err) {
              info.errorCheckingStatus = true;
            } else {
              info.canAttemptRefund = canAttemptRefund;
              info.claimableAmount = claimableAmount;
              info.prediction = prediction;
            }
            this.setState({
              rewardData: [...this.state.rewardData, info]
            });
          });
        });
      }).catch(err => {
        console.error(`Error getting original data for transactionHash: ${d.transactionHash}`);
        console.error(err);
      });
    });
  }

  processUploadedImageInput(acceptedFiles) {
    const reader = new FileReader();
    const file = acceptedFiles[0];

    // Examples of extra error processing.
    // reader.onabort = (err) => {console.error("File reading was aborted."); console.error(err);};
    // reader.onerror = (err) => {console.error("File reading has failed."); console.error(err);};
    reader.onload = () => {
      const binaryStr = reader.result;
      // Correct the orientation.
      loadImage(`data:${file.type};base64,${btoa(binaryStr)}`, (canvas) => {
        const imgElement = document.getElementById('input-image');
        imgElement.src = canvas.toDataURL();
      }, { orientation: true });
    }
    if (acceptedFiles.length > 1) {
      // TODO Report that extra files are ignored.
    }
    reader.readAsBinaryString(file);
  }

  /* MAIN CONTRACT FUNCTIONS */
  predict(data) {
    return this.state.classifier.methods.predict(data).call().then(parseInt);
  }

  predictInput() {
    this.setState({ encodedPredictionData: null });
    this.setState({ prediction: "(Transforming Input)" }, _ => {
      let input = this.state.input;
      if (this.state.inputType === 'image') {
        input = document.getElementById('input-image');
      }

      this.transformInput(input)
        .then(input => {
          this.setState({ encodedPredictionData: `Encoded data: ${this.getDisplayableEncodedData(input)}` });
          this.setState({ prediction: "(Predicting)" }, _ => {
            this.predict(input)
              .then(prediction => {
                this.setState({ prediction });
              }).catch(console.err);
          });
        }).catch((err) => {
          this.setState({ prediction: "(Error transforming input. See console for details.)" });
          console.error("Error transforming input.");
          console.error(err);
        });
    });
  }

  refund(time) {
    // There should just be one match but we might as well try to refund all.
    return this.state.addedData.filter(d => d.time === time).forEach(d => {
      return this.state.contractInstance.methods.refund(d.data, d.classification, d.time)
        .send({ from: this.state.accounts[0] })
        .on('transactionHash', (hash) => {
          // TODO Just Update row.
          this.updateRefundData();
          this.updateDynamicInfo();
        })
        .on('error', console.error);
    })
  }

  takeDeposit(time) {
    // There should just be one match but we might as well try to do all.
    this.state.rewardData.filter(d => d.time === time).forEach(d => {
      this.state.contractInstance.methods.report(d.data, d.classification, d.time, d.sender)
        .send({ from: this.state.accounts[0] })
        .on('transactionHash', (hash) => {
          // TODO Just Update row.
          this.updateRewardData();
        })
        .on('error', console.error);
    });
  }

  train() {
    const classification = this.state.trainClassIndex;
    let originalData = this.state.trainData;
    if (this.state.inputType === 'image') {
      originalData = document.getElementById('input-image');
    }
    return this.transformInput(originalData)
      .then(trainData => {
        return this.state.contractInstance.methods.addData(trainData, classification)
          .send({ from: this.state.accounts[0], value: this.state.depositCost })
          .on('transactionHash', (transactionHash) => {
            // TODO Pop up confirmation that data was sent.
            // console.log(`Data sent. status:${status}\nevents:`);

            // Save original training data.
            // We don't really need to save it to the blockchain
            // because there would be no way to enforce that it matches the data.
            // A malicious person could submit different data and encoded data
            // or just save funds by submitting no unencoded data.

            // FIXME If it's an image, use an identifier.
            return axios.post('/api/data', {
              originalData,
              transactionHash,
            }).then(() => {
              console.log("Saved info to DB.")
              return this.updateRefundData().then(this.updateDynamicInfo);
            }).catch(err => {
              console.error("Error saving original data to DB.")
            });
          })
          .on('receipt', (receipt) => {
            // Doesn't get triggered through promise after updating to `web3 1.0.0-beta.52`.
            // This event trigger doesn't seem to get triggered either.
            // const { events, /* status */ } = receipt;
            // console.log(events);
            // const vals = events.AddData.returnValues;
            console.log(`receipt: ${receipt}`);
          })
          .on('error', err => {
            console.error(err);
            alert("Error adding data. See the console for details.")
          });
      });
  }
  /* END MAIN CONTRACT FUNCTIONS */

  render() {
    return (
      <div>
        <Paper className={this.classes.root} elevation={1}>
          <Typography variant="h5" component="h3">
            {this.state.contractInfo.name}
          </Typography>
          <Typography component="p">
            {this.state.contractInfo.description}
          </Typography>
          <br />
          <br />
          {typeof this.state.accountScore !== 'undefined' &&
            <Typography component="p">
              <b>Your score: </b>
              {this.state.accountScore} ({this.state.numGood}/{this.state.totalGoodDataCount})
            </Typography>
          }
          <Typography component="p">
            <b>Time to wait before requesting a refund: </b>
            {this.state.refundWaitTimeS ?
              moment.duration(this.state.refundWaitTimeS, 's').humanize() :
              "(loading)"}
          </Typography>
          <Typography component="p">
            <b>Time to wait before taking another's deposit: </b>
            {this.state.ownerClaimWaitTimeS ?
              moment.duration(this.state.ownerClaimWaitTimeS, 's').humanize() :
              "(loading)"}
          </Typography>
          <Typography component="p" title={`${this.state.depositCost} wei`}>
            <b>Current Required Deposit: </b>
            {this.state.depositCost ?
              this.getHumanReadableEth(this.state.depositCost)
              : "(loading)"}
          </Typography>
          <div>
            <AppBar position="static" className={this.classes.tabs}>
              <Tabs
                value={this.state.tab}
                onChange={this.handleTabChange}
                centered>
                <Tab label="Predict" />
                <Tab label="Train" />
                <Tab label="Refund" />
                <Tab label="Reward" />
              </Tabs>
            </AppBar>
            {this.state.tab === 0 &&
              <TabContainer>
                <form id="predict-form" onSubmit={(e) => { e.preventDefault(); this.predictInput(); }}>
                  <div className={this.classes.tabContainer}>
                    {this.state.inputType === undefined ?
                      <div></div>
                      : this.state.inputType === 'text' ?
                        <TextField
                          name="input"
                          label="Input"
                          onChange={this.handleInputChange}
                          margin="normal" />
                        : <Dropzone onDrop={this.processUploadedImageInput}>
                          {({ getRootProps, getInputProps }) => (
                            <section>
                              <div {...getRootProps()}>
                                <input {...getInputProps()} />
                                <p>Drag 'n' drop some files here, or click to select files</p>
                                <img
                                  id="input-image"
                                  width="500"
                                  crossOrigin="anonymous"
                                  src={this.state.inputImageUrl}
                                  alt="The item to classify."
                                />
                              </div>
                            </section>
                          )}
                        </Dropzone>}
                    <Button type="submit" className={this.classes.button} variant="outlined"> Get Prediction </Button>
                    <br />
                    <br />
                    <Typography component="p" title={this.state.encodedPredictionData}>
                      <b>Prediction: </b>
                      {this.getSentiment(this.state.prediction)}
                    </Typography>
                  </div>
                </form>
              </TabContainer>
            }
            {this.state.tab === 1 &&
              <TabContainer>
                <form id="train-form" onSubmit={(e) => { e.preventDefault(); this.train(); }}>
                  <div className={this.classes.tabContainer}>
                    {this.state.inputType === undefined ?
                      <div></div>
                      : this.state.inputType === 'text' ?
                        <TextField
                          name="trainData"
                          label="Data Sample"
                          margin="normal"
                          onChange={this.handleInputChange}
                        />
                        : <Dropzone onDrop={this.processUploadedImageInput}>
                          {({ getRootProps, getInputProps }) => (
                            <section>
                              <div {...getRootProps()}>
                                <input {...getInputProps()} />
                                <p>Drag 'n' drop some files here, or click to select files</p>
                                <img
                                  id="input-image"
                                  width="500"
                                  crossOrigin="anonymous"
                                  src={this.state.inputImageUrl}
                                  alt="The item to classify."
                                />
                              </div>
                            </section>
                          )}
                        </Dropzone>}

                    <InputLabel htmlFor="classification-selector">Classification</InputLabel>
                    <Select
                      value={this.state.trainClassIndex}
                      onChange={this.handleInputChange}
                      inputProps={{
                        name: 'trainClassIndex',
                        id: 'classification-selector',
                      }}
                    >
                      {this.state.classifications.map((classificationName, classIndex) => {
                        return <MenuItem key={`class-select-${classificationName}`} value={classIndex}>
                          {classificationName}
                        </MenuItem>;
                      })}

                    </Select>
                    <Button type="submit" className={this.classes.button} variant="outlined" > Train </Button>
                  </div>
                </form>
              </TabContainer>
            }
            {this.state.tab === this.REFUND_TAB &&
              <div>
                {this.state.addedData.length === 0 &&
                  <Typography component="p">
                    No data has been submitted by you yet.
                  </Typography>
                }
                {this.state.addedData.length > 0 && <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Original Data</TableCell>
                      <TableCell>Submitted Classification</TableCell>
                      <TableCell>Initial Deposit</TableCell>
                      <TableCell>Date Added</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {this.state.addedData.map(d => {
                      return (<TableRow key={`refund-row-${d.time}`}>
                        <TableCell title={`Encoded data: ${this.getDisplayableEncodedData(d.data)}`}>
                          {d.originalData}{!d.dataMatches && " ⚠ The actual data doesn't match this!"}
                        </TableCell>
                        <TableCell>{this.getSentiment(d.classification)}</TableCell>
                        <TableCell title={`${d.initialDeposit} wei`}>
                          {this.getHumanReadableEth(d.initialDeposit)}
                        </TableCell>
                        <TableCell>{new Date(d.time * 1000).toString()}</TableCell>
                        <TableCell>
                          {d.errorCheckingStatus ?
                            "Error checking status"
                            : d.canAttemptRefund ?
                              <Button className={this.classes.button} variant="outlined"
                                onClick={() => this.refund(d.time)}>Refund {this.getHumanReadableEth(d.claimableAmount)}</Button>
                              : !d.hasEnoughTimePassed ?
                                `Wait ${moment.duration(d.time + this.state.refundWaitTimeS - (new Date().getTime() / 1000), 's').humanize()} to refund.`
                                : d.claimableAmount === 0 || d.claimableAmount === null ?
                                  `Already refunded or completely claimed.`
                                  : d.classification !== d.prediction ?
                                    `Classification doesn't match. Got "${this.getSentiment(d.prediction)}".`
                                    : `Can't happen?`
                          }
                        </TableCell>
                      </TableRow>);
                    })}
                  </TableBody>
                </Table>}
              </div>
            }
            {this.state.tab === this.REWARD_TAB &&
              <div>
                {(this.state.numGood === 0 || this.state.numGood === undefined) &&
                  <Typography component="p">
                    You must have some good data submitted before trying to take other's deposits.
                </Typography>}
                {this.state.rewardData.length === 0 &&
                  <Typography component="p">
                    No data has been submitted by other accounts yet.
                  </Typography>
                }
                {this.state.rewardData.length > 0 && <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Data</TableCell>
                      <TableCell>Submitted Classification</TableCell>
                      <TableCell>Initial Deposit</TableCell>
                      <TableCell>Date Added</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {this.state.rewardData.map(d => {
                      return (<TableRow key={`reward-row-${d.time}`}>
                        <TableCell title={`Encoded data: ${this.getDisplayableEncodedData(d.data)}`}>
                          {d.originalData}{!d.dataMatches && " ⚠ The actual data doesn't match this!"}
                        </TableCell>
                        <TableCell>{this.getSentiment(d.classification)}</TableCell>
                        <TableCell title={`${d.initialDeposit} wei`}>
                          {this.getHumanReadableEth(d.initialDeposit)}
                        </TableCell>
                        <TableCell>{new Date(d.time * 1000).toString()}</TableCell>
                        <TableCell>
                          {d.errorCheckingStatus ?
                            "Error checking status"
                            : d.hasEnoughTimePassed ?
                              d.canAttemptRefund ?
                                <Button className={this.classes.button} variant="outlined"
                                  onClick={() => this.takeDeposit(d.time)}>Take {this.getHumanReadableEth(d.claimableAmount)}</Button>
                                : this.state.numGood === 0 || this.state.numGood === undefined ?
                                  "Validate your own contributions first."
                                  : d.classification === d.prediction ?
                                    `Classification must be wrong for you to claim this. Got "${this.getSentiment(d.prediction)}".`
                                    : "Already refunded or completely claimed."
                              : `Wait ${moment.duration(d.time + this.state.refundWaitTimeS - (new Date().getTime() / 1000), 's').humanize()} to claim.`
                          }
                        </TableCell>
                      </TableRow>);
                    })}
                  </TableBody>
                </Table>}
              </div>
            }
          </div>
        </Paper>
      </div>
    );
  }
}

Model.propTypes = {
  classes: PropTypes.object.isRequired,
};

export default withStyles(styles)(Model);