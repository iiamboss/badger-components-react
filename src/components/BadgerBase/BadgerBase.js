// @flow

import * as React from 'react'

import {
	type CurrencyCode,
	buildPriceEndpoint,
	getCurrencyPreSymbol,
	getCurrencyPostSymbol,
	getSatoshiDisplayValue,
	formatPriceDisplay,
} from '../../utils/badger-helpers';


const PRICE_UPDATE_INTERVAL = 60 * 1000;


type Props = {
	to: string,
	price: number,
	currency: CurrencyCode,

	// showBrand?: boolean,
	// children: React.Node,

	successFn: Function,
	failFn?: Function,
};
type State = {
	step: 'fresh' | 'pending' | 'complete' | 'login' | 'install',
	BCHPrice: {
		[currency: CurrencyCode]: {
			price: ?number,
			stamp: ?number,
		},
	},
};

const BadgerBase = (Wrapped: React.AbstractComponent) => {
  return class extends React.Component<Props, State> {
    static defaultProps = {
      currency: 'USD',
    };
  
    state = {
      step: 'fresh',
      BCHPrice: {},
    };
  
    updateBCHPrice = async (currency: CurrencyCode) => {
      const priceRequest = await fetch(buildPriceEndpoint(currency));
      const result = await priceRequest.json();
  
      const { price, stamp } = result;
      this.setState({
        BCHPrice: { [currency]: { price, stamp } },
      });
    };
  
    handleClick = () => {
      const { to, successFn, failFn, currency, price } = this.props;
      const { BCHPrice } = this.state;
  
      const priceInCurrency = BCHPrice[currency].price;
      if (!priceInCurrency) {
        this.updateBCHPrice(currency);
        return;
      }
  
      const singleDollarValue = priceInCurrency / 100;
      const singleDollarSatoshis = 100000000 / singleDollarValue;
      const satoshis = price * singleDollarSatoshis;
  
      if (window && typeof window.Web4Bch !== 'undefined') {
        const { web4bch } = window;
  
        const web4bch2 = new window.Web4Bch(web4bch.currentProvider);
        const { defaultAccount } = web4bch2.bch;
  
        if (!defaultAccount) {
          this.setState({ step: 'login' });
          return;
        }
  
        const txParams = {
          to,
          from: defaultAccount,
          value: satoshis,
        };
  
        this.setState({ step: 'pending' });
  
        web4bch2.bch.sendTransaction(txParams, (err, res) => {
          if (err) {
            console.log('BadgerButton send cancel', err);
            failFn && failFn(err);
            this.setState({ step: 'fresh' });
          } else {
            console.log('BadgerButton send success:', res);
            successFn(res);
            this.setState({ step: 'complete' });
          }
        });
      } else {
        this.setState({ step: 'install' });
        window.open('https://badger.bitcoin.com');
      }
    };
  
    gotoLoginState = () => {
      this.setState({ step: 'login' });
      this.intervalLogin = setInterval(() => {
        const { web4bch } = window;
        const web4bch2 = new window.Web4Bch(web4bch.currentProvider);
        const { defaultAccount } = web4bch2.bch;
        if (defaultAccount) {
          clearInterval(this.intervalLogin);
          this.setState({ step: 'fresh' });
        }
      }, 1000);
    };
  
    componentDidMount() {
      const currency = this.props.currency;
  
      // Get price on load, and update price every minute
      this.updateBCHPrice(currency);
      this.priceInterval = setInterval(
        () => this.updateBCHPrice(currency),
        PRICE_UPDATE_INTERVAL
      );
  
      // Determine Button initial state
      if (window && typeof window.Web4Bch === 'undefined') {
        this.setState({ step: 'install' });
      } else {
        const { web4bch } = window;
        const web4bch2 = new window.Web4Bch(web4bch.currentProvider);
        const { defaultAccount } = web4bch2.bch;
        if (!defaultAccount) {
          this.gotoLoginState();
        }
      }
    }
  
    componentWillUnmount() {
      this.priceInterval && clearInterval(this.priceInterval);
      this.intervalLogin && clearInterval(this.intervalLogin);
    }
  
    componentDidUpdate(prevProps: Props) {
      const { currency } = this.props;
      const prevCurrency = prevProps.currency;
  
      // Clear previous price interval, set a new one, and immediately update price
      if (currency !== prevCurrency) {
        this.priceInterval && clearInterval(this.priceInterval);
        this.priceInterval = setInterval(
          () => this.updateBCHPrice(currency),
          PRICE_UPDATE_INTERVAL
        );
        this.updateBCHPrice(currency);
      }
    }

    render() {
      // TODO - re-think price
      const {...passThrough} = this.props

      const { step, BCHPrice} = this.state;

      return <Wrapped {...passThrough} step={step} BCHPrice={BCHPrice} />
    }
  }
}

export default BadgerBase;