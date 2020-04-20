
import cookie from 'react-cookies';
import { applyMiddleware, createStore, compose } from 'redux';
import thunk from 'redux-thunk';

import { fetchComponentTypes, fetchDevices, fetchUserProfile } from '../actions';
import rootReducer from '../reducers/index';
import { onMiddleware } from '../middleware'

import { SET_PLAYGROUND, SET_TYPE_GROUP, SET_COMPONENT, SET_COMMENT } from '../../consts/action-types';

const createLogActionStackTraceMiddleware = (actionTypes=[])=> {
  const logActionStackTraceMiddleware = (storeAPI)=> (next)=> (action)=> {
    if(action.type && actionTypes.includes(action.type)) {
    	console.log('[|:|] Store', storeAPI.getState());
      // console.trace('[:|:] '%s'', action.type, action);
    }

    return (next(action));
  };

  return (logActionStackTraceMiddleware);
};


const stackTraceMiddleware = createLogActionStackTraceMiddleware([SET_PLAYGROUND, SET_TYPE_GROUP, SET_COMPONENT, SET_COMMENT]);





const store = createStore(rootReducer, applyMiddleware(onMiddleware, thunk));
// const store = createStore(rootReducer, compose(applyMiddleware(onMiddleware, thunk, stackTraceMiddleware)));


console.log('!!!!!!!!!!!!!!!', { rootReducer, onMiddleware });
if (typeof cookie.load('user_id') === 'undefined') {
	cookie.save('user_id', '0', { path : '/', sameSite : false });

} else {
	store.dispatch(fetchUserProfile());
}

store.dispatch(fetchComponentTypes());
store.dispatch(fetchDevices());


export default store;