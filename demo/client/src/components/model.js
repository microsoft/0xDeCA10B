import AppBar from '@material-ui/core/AppBar';
import Button from '@material-ui/core/Button';
import Container from '@material-ui/core/Container';
import InputLabel from '@material-ui/core/InputLabel';
import Link from '@material-ui/core/Link';
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
import * as tf from '@tensorflow/tfjs';
import loadImage from 'blueimp-load-image';
import update from 'immutability-helper';
import moment from 'moment';
import { withSnackbar } from 'notistack';
import PropTypes from 'prop-types';
import React from 'react';
import Dropzone from 'react-dropzone';
import ClipLoader from 'react-spinners/ClipLoader';
import GridLoader from 'react-spinners/GridLoader';
import CollaborativeTrainer from '../contracts/compiled/CollaborativeTrainer64.json';
import { ContractLoader } from '../contracts/loader';
import ImdbVocab from '../data/imdb.json';
import { getNetworkType, getWeb3 } from '../getWeb3';
import { OnlineSafetyValidator } from '../safety/validator';
import { OriginalData } from '../storage/data-store';
import { DataStoreFactory } from '../storage/data-store-factory';
import { checkStorages, renderStorageSelector } from './storageSelector';

moment.relativeTimeThreshold('ss', 4);

const INPUT_TYPE_IMAGE = 'image';
const INPUT_TYPE_TEXT = 'text';

const styles = theme => ({
  root: {
    ...theme.mixins.gutters(),
    paddingTop: theme.spacing(2),
    paddingBottom: theme.spacing(2),
    marginBottom: theme.spacing(2),
    display: 'flex',
    flexDirection: 'column'
  },
  info: {
    paddingBottom: theme.spacing(1),
  },
  controls: {
    paddingTop: theme.spacing(1),
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

class Model extends React.Component {
  PREDICT_TAB = 0;
  TRAIN_TAB = 1;
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

    // Default to local storage for storing original data.
    const storageType = localStorage.getItem('storageType') || 'local';
    this.storages = DataStoreFactory.getAll()

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
      readyForInput: false,
      contractInfo: {},
      modelId: currentUrlParams.get('modelId'),
      metaDataLocation: currentUrlParams.get('metaDataLocation') || 'local',
      contractAddress: currentUrlParams.get('address'),
      classifications: [],
      tab: tabIndex,
      addedData: [],
      rewardData: [],
      contractInstance: undefined,
      depositCost: undefined,
      featureIndices: undefined,
      trainClassIndex: 0,
      inputType: undefined,
      input: "",
      inputImageUrl: require("../images/hot_dog.jpg"),
      acceptedFiles: undefined,
      predicting: false,
      accounts: undefined,
      prediction: undefined,
      accountScore: undefined,
      numGood: undefined,
      toFloat: undefined,
      totalGoodDataCount: undefined,
      storageType,
      permittedStorageTypes: [],
      // Default to restricting content for safety.
      checkedContentRestriction: false,
      restrictContent: true,
    }

    this.addDataCost = this.addDataCost.bind(this);
    this.canAttemptRefund = this.canAttemptRefund.bind(this);
    this.getContractInstance = this.getContractInstance.bind(this);
    this.handleInputChange = this.handleInputChange.bind(this);
    this.handleTabChange = this.handleTabChange.bind(this);
    this.hasEnoughTimePassed = this.hasEnoughTimePassed.bind(this);
    this.normalize = this.normalize.bind(this);
    this.predict = this.predict.bind(this);
    this.predictInput = this.predictInput.bind(this);
    this.processUploadedImageInput = this.processUploadedImageInput.bind(this);
    this.refund = this.refund.bind(this);
    this.setContractInstance = this.setContractInstance.bind(this);
    this.setFeatureIndices = this.setFeatureIndices.bind(this);
    this.takeDeposit = this.takeDeposit.bind(this);
    this.train = this.train.bind(this);
    this.updateDynamicAccountInfo = this.updateDynamicAccountInfo.bind(this);
    this.updateDynamicInfo = this.updateDynamicInfo.bind(this);
    this.updateRefundData = this.updateRefundData.bind(this);
    this.updateRewardData = this.updateRewardData.bind(this);
  }

  componentDidMount = async () => {
    checkStorages(this.storages).then(permittedStorageTypes => {
      permittedStorageTypes.push('none')
      this.setState({ permittedStorageTypes })
    })
    try {
      this.web3 = await getWeb3()

      const storage = this.storages[this.state.metaDataLocation];
      let contractInfo
      try {
        contractInfo = await storage.getModel(this.state.modelId, this.state.contractAddress);
      } catch (err) {
        // `setContractInstance` will set the other fields on `contractInfo`.
        contractInfo = {}
        contractInfo.address = this.state.contractAddress
      }
      this.setState({ contractInfo },
        async _ => {
          await this.setContractInstance()
          if (typeof window !== "undefined" && window.ethereum) {
            window.ethereum.on('accountsChanged', accounts => {
              this.setState({ accounts, addedData: [], rewardData: [] }, _ => {
                this.updateDynamicAccountInfo().then(() => {
                  this.handleTabChange(null, this.state.tab)
                })
              })
            })
            window.ethereum.on('networkChanged', netId => {
              this.setContractInstance()
            })
          }
        });
    } catch (error) {
      console.error(error);
      this.notify("Failed to load web3, accounts, or contract. Check console for details.", { variant: 'error' })
    }
  }

  notify(...args) {
    return this.props.enqueueSnackbar(...args);
  }

  dismissNotification(...args) {
    return this.props.closeSnackbar(...args);
  }

  setContractInstance = async () => {
    this.setState({ readyForInput: false })
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
    }

    {
      const validator = new OnlineSafetyValidator(this.web3)
      const networkType = await getNetworkType()
      this.setState({
        checkedContentRestriction: true,
        restrictContent: !validator.isPermitted(networkType, contractAddress)
      })
    }

    // Using one `.then` and then awaiting helps with making the page more responsive.
    new ContractLoader(this.web3).load(contractAddress).then(async collabTrainer => {
      const contractInstance = collabTrainer.mainEntryPoint
      const { classifier, dataHandler, incentiveMechanism } = collabTrainer
      
      // TODO Set fields in this.state.contractInfo that are not set yet.

      this.setState({ accounts, classifier, contractInstance, dataHandler, incentiveMechanism }, _ => {
        Promise.all([
          this.updateContractInfo(),
          this.updateDynamicInfo(),
          this.setTransformInputMethod(),
          this.setFeatureIndices(),
        ]).then(_ => {
          this.setState({ readyForInput: true });
          this.handleTabChange(null, this.state.tab);
          setInterval(this.updateDynamicInfo, 15 * 1000);
        })
      })
    }).catch(err => {
      // TODO Display persistent error message.
      this.notify(`There was an error loading the contract at ${contractAddress}. Try using a different network.`, { variant: 'error' })
      console.error(err)
    })
  }

  /**
   * @param {Array[Number]} data 
   * @returns Normalized `data` using the result of the norm from the classifier contract.
   * The result is in the mapped space (multiplied by `this.state.toFloat`.
   */
  async normalize(data) {
    const convertedData = data.map(x => Math.round(x * this.state.toFloat));
    return this.state.classifier.methods.norm(convertedData.map(v => this.web3.utils.toHex(v))).call()
      .then(norm => {
        norm = this.web3.utils.toBN(norm);
        const _toFloat = this.web3.utils.toBN(this.state.toFloat);
        return convertedData.map(v => this.web3.utils.toBN(v).mul(_toFloat).div(norm));
      });
  }

  async setTransformInputMethod() {
    if (this.state.contractInfo.encoder === 'universal sentence encoder') {
      this.setState({ inputType: INPUT_TYPE_TEXT });
      UniversalSentenceEncoder.load().then(use => {
        this.transformInput = async (query) => {
          const embeddings = await use.embed(query);
          let embedding = tf.tidy(_ => {
            const emb = embeddings.gather(0);
            if (this.state.featureIndices !== undefined && this.state.featureIndices.length > 0) {
              return emb.gather(this.state.featureIndices).arraySync();
            }
            return emb.arraySync();
          });
          embeddings.dispose();
          return this.normalize(embedding).then(normalizedEmbedding => {
            return normalizedEmbedding.map(v => this.web3.utils.toHex(v));
          });
        };
        this.transformInput = this.transformInput.bind(this);
      });
    } else if (this.state.contractInfo.encoder === 'MobileNetv2') {
      this.setState({ inputType: INPUT_TYPE_IMAGE });
      // https://github.com/tensorflow/tfjs-models/tree/master/mobilenet
      mobilenet.load({
        version: 2,
        alpha: 1,
      }).then(model => {
        this.transformInput = async (imgElement) => {
          if (Array.isArray(imgElement)) {
            // Assume this is from given data and this method is being called from data already in the database.
            return imgElement;
          }
          const imgEmbedding = await model.infer(imgElement, { embedding: true });
          let embedding = tf.tidy(_ => {
            const embedding = imgEmbedding.gather(0);
            if (this.state.featureIndices !== undefined && this.state.featureIndices.length > 0) {
              return embedding.gather(this.state.featureIndices).arraySync();
            }
            return embedding.arraySync();
          });
          imgEmbedding.dispose();
          return this.normalize(embedding).then(normalizedEmbedding => {
            return normalizedEmbedding.map(v => this.web3.utils.toHex(v));
          });
        }
        this.transformInput = this.transformInput.bind(this);
      });
    } else if (this.state.contractInfo.encoder === 'IMDB vocab') {
      this.setState({ inputType: INPUT_TYPE_TEXT });
      this.vocab = [];
      Object.entries(ImdbVocab).forEach(([key, value]) => {
        this.vocab[value] = key;
      });
      this.transformInput = async (query) => {
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
      this.transformInput = this.transformInput.bind(this);
    } else {
      throw new Error(`Couldn't find encoder for ${this.state.contractInfo.encoder}`);
    }
  }

  async setFeatureIndices() {
    return this.state.classifier.methods.getNumFeatureIndices().call()
      .then(parseInt)
      .then(numFeatureIndices => {
        return Promise.all([...Array(numFeatureIndices).keys()].map(i => {
          return this.state.classifier.methods.featureIndices(i).call().then(parseInt);
        })).then(featureIndices => {
          this.setState({ featureIndices });
        });
      });
  }

  addDataCost() {
    const now = Math.floor(new Date().getTime() / 1000);
    return this.state.incentiveMechanism.methods.getNextAddDataCost(now).call()
      .then(parseInt);
  }

  async canAttemptRefund(data, isForTaking) {
    // TODO Duplicate more of the contract's logic here.
    // This will help with giving better error messages and avoid trying to create new transactions.

    let canAttemptRefund = false
    if (isForTaking && (this.state.numGood === 0 || this.state.numGood === undefined)) {
      return { canAttemptRefund }
    }
    const claimer = this.state.accounts[0]
    const dataSample = data.data
    return this.state.dataHandler.methods.hasClaimed(dataSample, data.classification, data.time, data.sender, claimer).call()
      .then(async hasClaimed => {
        data.alreadyClaimed = hasClaimed
        if (hasClaimed) {
          canAttemptRefund = false
          return { canAttemptRefund }
        }

        let claimableAmount = await this.state.dataHandler.methods.getClaimableAmount(dataSample, data.classification, data.time, data.sender).call().then(parseInt)

        if (data.initialDeposit === 0) {
          // This was likely for a points-based IM.
          // A refund/report can only be done if no one else has made one yet.
          const numClaims = await this.state.dataHandler.methods.getNumClaims(dataSample, data.classification, data.time, data.sender).call().then(parseInt)
          if (numClaims > 0) {
            canAttemptRefund = false
            data.alreadyClaimed = true
            return { canAttemptRefund, claimableAmount }
          }
        } else if (claimableAmount <= 0) {
          // There was an initial deposit but none of it is left.
          canAttemptRefund = false
          data.alreadyClaimed = true
          return { canAttemptRefund, claimableAmount }
        }
        const prediction = await this.predict(dataSample)
        if (isForTaking) {
          // Prediction must be wrong.
          canAttemptRefund = prediction !== data.classification
          // Take the floor since that is what Solidity will do.      
          const amountShouldGet = Math.floor(data.initialDeposit * this.state.numGood / this.state.totalGoodDataCount);
          if (amountShouldGet !== 0) {
            claimableAmount = amountShouldGet
          }
        } else {
          canAttemptRefund = prediction === data.classification
        }
        return { canAttemptRefund, claimableAmount, prediction }
      }).catch(err => {
        console.error("Error determining if a refund can be done.")
        console.error(err)
        canAttemptRefund = false
        return { canAttemptRefund, err }
      });
  }

  async getContractInstance(options) {
    return new this.web3.eth.Contract(options.abi, options.address);
  }

  getDisplayableEncodedData(data) {
    let d = data.map(v => this.web3.utils.toBN(v).toNumber());
    const divideFloatList = ['MobileNetv2', 'universal sentence encoder'];
    if (divideFloatList.indexOf(this.state.contractInfo.encoder) > -1) {
      const _toFloat = this.state.toFloat;
      d = d.map(v => v / _toFloat);
    }
    let result = JSON.stringify(d, null, 2);
    if (result.length > 110) {
      result = result.slice(0, 100) + "...";
    }
    return result;
  }

  getDisplayableOriginalData(data, isForTaking = false) {
    if (data === undefined) {
      return "(not found)"
    }
    if (isForTaking && this.state.restrictContent) {
      return "(hidden)"
    }
    if (typeof data === 'string') {
      return `"${data}"`;
    }
    if (Array.isArray(data)) {
      let result = JSON.stringify(data, null, 2);
      if (result.length > 110) {
        result = result.slice(0, 100) + "...";
      }
      return result;
    }
    return data;
  }

  getHumanReadableEth(amount) {
    // Could use web3.fromWei but it returns a string and then truncating would be trickier/less efficient.
    let result
    if (amount !== 0) {
      result = (amount * 1E-18).toFixed(6)
    } else {
      result = 0
    }
    return `Ξ${result}`
  }

  /**
   * 
   * @param {string} transactionHash The transaction hash for the transacation that added the data.
   * @returns A representation of the original data. If the storage type is 'none' or the data cannot be found then `undefined` is returned.
   */
  async getOriginalData(transactionHash) {
    if (this.state.storageType === 'none') {
      return undefined;
    }
    return this.storages[this.state.storageType].getOriginalData(transactionHash).then(originalData => {
      originalData = originalData.text
      if (this.state.inputType === INPUT_TYPE_IMAGE) {
        // Return the encoding.
        originalData = JSON.parse(originalData);
      }
      return originalData;
    }).catch(err => {
      console.warn(`Could not find the original data for ${transactionHash}.`);
      console.warn(err);
    });
  }

  getClassificationName(val) {
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
    }, _ => {
      if (name === 'storageType') {
        localStorage.setItem(name, value);
        // TODO Just update the original data field.
        this.updateRefundData();
        this.updateRewardData();
      }
    });
  }

  handleTabChange(_, value) {
    const tab = this.TABS[value];

    // Change URL.
    const currentUrlParams = new URLSearchParams(window.location.search);
    if (currentUrlParams.get('tab') !== tab) {
      currentUrlParams.set('tab', tab);
      this.props.history.push(window.location.pathname + "?" + currentUrlParams.toString())
    }
    this.setState({ tab: value });

    if (this.PREDICT_TAB === value || this.TRAIN_TAB === value) {
      if (this.state.acceptedFiles) {
        this.loadImageToElement(this.state.acceptedFiles[0]);
      }
    } else if (this.REFUND_TAB === value) {
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
        }).catch(err => {
          console.error("Could not get the number of classifications.");
          console.error(err);
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
      this.state.incentiveMechanism.methods.refundWaitTimeS().call()
        .then(parseInt)
        .then(refundWaitTimeS => {
          this.setState({ refundWaitTimeS });
        }).catch(err => {
          console.error("Couldn't get refundWaitTimeS value from IM.");
          console.error(err);
        }),
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
    return Promise.all([
      Promise.resolve(this.state.accounts && this.state.accounts[0]).then(account => {
        if (account) {
          return this.state.incentiveMechanism.methods.numValidForAddress(account).call()
            .then(parseInt)
        }
      }),
      this.state.incentiveMechanism.methods.totalGoodDataCount().call()
        .then(parseInt)
    ]).then(([numGood, totalGoodDataCount]) => {
      let accountScore
      if (numGood !== undefined) {
        if (totalGoodDataCount > 0) {
          accountScore = (100 * numGood / totalGoodDataCount).toFixed(2) + "%";
        } else {
          accountScore = "0%";
        }
      } else {
        accountScore = "(no account specified in browser)"
      }
      this.setState({ accountScore, numGood, totalGoodDataCount });
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

      this.getOriginalData(d.transactionHash).then(async originalData => {
        const info = {
          data, classification, initialDeposit, sender, time,
          originalData: this.getDisplayableOriginalData(originalData),
        };
        if (originalData !== undefined) {
          // If transforming the input takes a long time then it's possible that flag does not get added to the actual page.
          this.transformInput(originalData).then(encodedData => {
            info.dataMatches = areDataEqual(data, encodedData);
          });
        }

        info.hasEnoughTimePassed = this.hasEnoughTimePassed(info, this.state.refundWaitTimeS);
        // TODO Don't explicitly set hasEnoughTimePassed on the info in case the timing is off on the info
        // in case the user wants to send the request anyway and hope that by the time the transaction is processed
        // that the request will be valid. In general these checks should just be done as warnings.
        this.canAttemptRefund(info, false).then(refundInfo => {
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
          this.setState(prevState => ({
            addedData: prevState.addedData.concat([info])
          }));
        });
      }).catch(err => {
        console.error(`Error getting original data for transactionHash: ${d.transactionHash}`);
        console.error(err);
      });
    });
  }

  updateRewardData() {
    const isForTaking = true
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
        const info = {
          data, classification, initialDeposit, sender, time,
          originalData: this.getDisplayableOriginalData(originalData, isForTaking),
        };
        if (originalData !== undefined) {
          // If transforming the input takes a long time then it's possible that flag does not get added to the actual page.
          this.transformInput(originalData).then(encodedData => {
            info.dataMatches = areDataEqual(data, encodedData);
          });
        }

        info.hasEnoughTimePassed = this.hasEnoughTimePassed(info, this.state.refundWaitTimeS);
        this.canAttemptRefund(info, isForTaking).then(refundInfo => {
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
          this.setState(prevState => ({
            rewardData: prevState.rewardData.concat([info])
          }));
        });
      }).catch(err => {
        console.error(`Error getting original data for transactionHash: ${d.transactionHash}`);
        console.error(err);
      });
    });
  }

  processUploadedImageInput(acceptedFiles) {
    this.setState({ prediction: undefined });
    if (acceptedFiles.length === 0 || acceptedFiles.length > 1) {
      this.notify("Please only provide one image", { variant: 'warning' })
    }
    const file = acceptedFiles[0];
    this.setState({ acceptedFiles: [file] });
    this.loadImageToElement(file);
  }

  loadImageToElement(file) {
    const reader = new FileReader();
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
    };
    reader.readAsBinaryString(file);
  }

  /* MAIN CONTRACT FUNCTIONS */
  predict(data) {
    // IMPORTANT: Use .call to not create a transaction as explained in the about page.
    return this.state.classifier.methods.predict(data).call().then(parseInt);
  }

  predictInput() {
    this.setState({
      encodedPredictionData: null, predicting: true,
      prediction: "(Transforming Input)"
    }, _ => {
      let input = this.state.input;
      if (this.state.inputType === INPUT_TYPE_IMAGE) {
        input = document.getElementById('input-image');
      }

      this.transformInput(input)
        .then(input => {
          this.setState({ encodedPredictionData: `Encoded data: ${this.getDisplayableEncodedData(input)}` });
          this.setState({ prediction: "(Predicting)" }, _ => {
            this.predict(input)
              .then(prediction => {
                this.setState({ prediction, predicting: false });
              }).catch(err => {
                this.setState({ prediction: "(Error predicting. See console for details.)", predicting: false });
                console.error(err);
              });
          });
        }).catch((err) => {
          this.setState({ prediction: "(Error transforming input. See console for details.)", predicting: false });
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
    let originalData = this.state.input;
    if (this.state.inputType === INPUT_TYPE_IMAGE) {
      originalData = document.getElementById('input-image');
    }
    return this.transformInput(originalData)
      .then(trainData => {
        // TODO Pass around BN's and avoid rounding issues.
        // Add extra wei to help with rounding issues. Extra gets returned right away by the contract.
        const value = this.state.depositCost + (this.state.depositCost > 0 ? 1E14 : 0)
        let sentNotificationKey;
        return this.state.contractInstance.methods.addData(trainData, classification)
          .send({ from: this.state.accounts[0], value })
          .on('transactionHash', (transactionHash) => {
            sentNotificationKey = this.notify("Data was sent but has not been confirmed yet")

            // Save original training data.
            // We don't really need to save it to the blockchain
            // because there would be no way to enforce that it matches the data.
            // A malicious person could submit different data and encoded data
            // or just save funds by submitting no unencoded data.

            if (this.state.inputType === INPUT_TYPE_IMAGE) {
              // Just store the encoding.
              originalData = JSON.stringify(trainData);
            }
            if (this.state.storageType !== 'none') {
              const storage = this.storages[this.state.storageType];
              return storage.saveOriginalData(transactionHash, new OriginalData(originalData)).then(() => {
                this.notify("Saved info to database", { variant: 'success' })
                return this.updateRefundData().then(this.updateDynamicInfo);
              }).catch(err => {
                this.notify("Error saving original data to the database.", { variant: 'error' })
                console.error("Error saving original data to the database.");
                console.error(err);
              });
            }
          })
          .on('receipt', (_receipt) => {
            // Doesn't get triggered through promise after updating to `web3 1.0.0-beta.52`.
            // Some helpful fields:
            // const { events, /* status */ } = receipt;
            // const vals = events.AddData.returnValues;
            // const { transactionHash } = receipt;
            if (sentNotificationKey) {
              this.dismissNotification(sentNotificationKey)
            }
          })
          .on('error', err => {
            console.error(err);
            this.notify("Error adding data. See the console for details.", { variant: 'error' })
          });
      });
  }
  /* END MAIN CONTRACT FUNCTIONS */

  renderLoadingContract() {
    return this.state.readyForInput || <div>
      <ClipLoader loading={!this.state.readyForInput} size="16" color="#2196f3" /> Loading contract and model information.
    </div>;
  }

  render() {
    return (
      <Container>
        <Paper className={this.classes.root} elevation={1}>
          <Typography variant="h5" component="h3">
            {this.state.checkedContentRestriction ?
              this.state.contractInfo.name && this.state.restrictContent ?
                "(hidden)"
                : this.state.contractInfo.name
              : "(loading)"
            }
          </Typography>

          {this.state.checkedContentRestriction ?
            this.state.contractInfo.description && this.state.restrictContent ?
              <Typography component="p">
                {"⚠ The details for this model cannot be shown because it has not been verified. \
                  Text and images from other users will not be shown in order to ensure online safety. "}
                <Link href='/about' target='_blank'>Learn more</Link>.
              </Typography>
              : <Typography component="p">{this.state.contractInfo.description}</Typography>
            : <Typography component="p">{"(loading)"}</Typography>
          }

          <br />
          <br />
          <div className={this.classes.info}>
            <Typography component="p">
              <b>Your score: </b>
              {this.state.accountScore !== undefined ? this.state.accountScore : "(loading)"}
              {this.state.totalGoodDataCount !== undefined ?
                ` (${this.state.numGood || 0}/${this.state.totalGoodDataCount || 0})`
                : ""
              }
            </Typography>
            <Typography component="p">
              <b>Time to wait before requesting a refund: </b>
              {this.state.refundWaitTimeS !== undefined ?
                this.state.refundWaitTimeS !== 0 ?
                  moment.duration(this.state.refundWaitTimeS, 's').humanize()
                  : "0 seconds"
                : "(loading)"}
            </Typography>
            <Typography component="p">
              <b>Time to wait before taking another's deposit: </b>
              {this.state.ownerClaimWaitTimeS !== undefined ?
                this.state.ownerClaimWaitTimeS !== 0 ?
                  moment.duration(this.state.ownerClaimWaitTimeS, 's').humanize()
                  : "0 seconds"
                : "(loading)"}
            </Typography>
            <Typography component="p" title={`${this.state.depositCost} wei`}>
              <b>Current Required Deposit: </b>
              {this.state.depositCost !== undefined ?
                this.getHumanReadableEth(this.state.depositCost)
                : "(loading)"}
            </Typography>
          </div>
          <div className={this.classes.controls}>
            {renderStorageSelector("where to store the link between your update and your original unprocessed data",
              this.state.storageType, this.handleInputChange, this.state.permittedStorageTypes)}
          </div>
          <div>
            <AppBar position="static" className={this.classes.tabs}>
              <Tabs
                value={this.state.tab}
                variant="fullWidth"
                onChange={this.handleTabChange}
                centered>
                <Tab label="Predict" />
                <Tab label="Train" />
                <Tab label="Refund" />
                <Tab label="Reward" />
              </Tabs>
            </AppBar>
            {this.state.tab === this.PREDICT_TAB &&
              <TabContainer>
                <form id="predict-form" onSubmit={(e) => { e.preventDefault(); this.predictInput(); }}>
                  <div className={this.classes.tabContainer}>
                    {this.renderInputBox()}
                    <br />
                    {this.renderLoadingContract()}
                    <Button type="submit" className={this.classes.button} variant="outlined"
                      disabled={!this.state.readyForInput}>
                      Get Prediction
                    </Button>
                    <br />
                    <Typography component="p" title={this.state.encodedPredictionData}>
                      <b>Prediction: {this.state.restrictContent ? this.state.prediction : this.getClassificationName(this.state.prediction)}</b>
                    </Typography>
                    <GridLoader loading={this.state.predicting}
                      size="15"
                      color="#2196f3"
                    />
                  </div>
                </form>
              </TabContainer>
            }
            {this.state.tab === this.TRAIN_TAB &&
              <TabContainer>
                <form id="train-form" onSubmit={(e) => { e.preventDefault(); this.train(); }}>
                  <div className={this.classes.tabContainer}>
                    {this.renderInputBox()}
                    <InputLabel htmlFor="classification-selector">Classification</InputLabel>
                    <Select
                      value={this.state.trainClassIndex < this.state.classifications.length ? this.state.trainClassIndex : ''}
                      onChange={this.handleInputChange}
                      inputProps={{
                        name: 'trainClassIndex',
                        id: 'classification-selector',
                      }}
                    >
                      {this.state.classifications.map((classificationName, classIndex) => {
                        return <MenuItem key={`class-select-${classIndex}`} value={classIndex}>
                          {this.state.restrictContent ? classIndex : classificationName}
                        </MenuItem>;
                      })}
                    </Select>
                    {this.renderLoadingContract()}
                    <Button type="submit" className={this.classes.button} variant="outlined"
                      disabled={!this.state.readyForInput}>
                      Train
                    </Button>
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
                          {d.originalData}{d.dataMatches === false && " ⚠ The actual data doesn't match this!"}
                        </TableCell>
                        <TableCell>{this.state.restrictContent ? d.classification : this.getClassificationName(d.classification)}</TableCell>
                        <TableCell title={`${d.initialDeposit} wei`}>
                          {this.getHumanReadableEth(d.initialDeposit)}
                        </TableCell>
                        <TableCell>{new Date(d.time * 1000).toString()}</TableCell>
                        <TableCell>
                          {/* Most of these checks should actually just be warnings and not explicitly forbid requesting
                              because the request might be valid by the time the transaction actually gets processed. */}
                          {d.errorCheckingStatus ?
                            "Error checking status"
                            : d.hasEnoughTimePassed ?
                              d.canAttemptRefund ?
                                <Button className={this.classes.button} variant="outlined"
                                  onClick={() => this.refund(d.time)}>Refund {this.getHumanReadableEth(d.claimableAmount)}</Button>
                                : d.alreadyClaimed ?
                                  "Already refunded or completely claimed."
                                  : d.classification !== d.prediction ?
                                    `Classification does not match. Got "${this.state.restrictContent ? d.prediction : this.getClassificationName(d.prediction)}".`
                                    : "Can't happen?"
                              : `Wait ${moment.duration(d.time + this.state.refundWaitTimeS - (new Date().getTime() / 1000), 's').humanize()} to refund.`
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
                          {d.originalData}{d.dataMatches === false && " ⚠ The actual data doesn't match this!"}
                        </TableCell>
                        <TableCell>{this.state.restrictContent ? d.classification : this.getClassificationName(d.classification)}</TableCell>
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
                                  : d.alreadyClaimed ?
                                    "Already refunded or completely claimed."
                                    : d.classification === d.prediction ?
                                      `Classification must be wrong for you to claim this. Got "${this.state.restrictContent ? d.prediction : this.getClassificationName(d.prediction)}".`
                                      : "Can't happen?"
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
      </Container>
    );
  }

  renderInputBox() {
    return this.state.inputType === undefined ?
      <div></div>
      : this.state.inputType === INPUT_TYPE_TEXT ?
        <TextField inputProps={{ 'aria-label': "Input to the model" }} name="input" label="Input" onChange={this.handleInputChange} margin="normal"
          value={this.state.input}
        />
        : <Dropzone onDrop={this.processUploadedImageInput}>
          {({ getRootProps, getInputProps }) => (<section>
            <div {...getRootProps()}>
              <input {...getInputProps()} />
              <Typography component="p">
                Drag and drop an image here, or click to select a file
              </Typography>
              <img id="input-image" width="300" crossOrigin="anonymous" alt="The item to classify or train with."
                src={this.state.acceptedFiles ? undefined : this.state.inputImageUrl} />
            </div>
          </section>)}
        </Dropzone>;
  }
}

Model.propTypes = {
  classes: PropTypes.object.isRequired,
};

export default withSnackbar(withStyles(styles)(Model));
