
import { Objects } from 'lang-js-utils';

import {
	ADD_FILE_UPLOAD,
	APPEND_ARTBOARD_SLICES,
	APPEND_HOME_ARTBOARDS,
	SET_ARTBOARD_COMPONENT,
	SET_ARTBOARD_GROUPS,
	COMPONENT_TYPES_LOADED,
	EVENT_GROUPS_LOADED,
	SET_REDIRECT_URI,
	UPDATE_DEEPLINK,
	UPDATE_MOUSE_COORDS,
	USER_PROFILE_ERROR,
	USER_PROFILE_LOADED,
	USER_PROFILE_UPDATED,
	SET_INVITE,
	SET_TEAMS,
} from '../../consts/action-types';
// import { LOG_REDUCER_PREFIX } from '../../consts/log-ascii';


const initialState = {
	file               : null,
	homeArtboards      : [],
	artboardComponents : null,
	artboardGroups     : [],
	componentTypes     : null,
	eventGroups        : [],
	deeplink           : {
		teamID       : 0,
		buildID      : 0,
		playgroundID : 0,
		typeGroupID  : 0,
		componentID  : 0,
		commentID    : 0
	},
	redirectURI        : null,
	uploadSlices       : [],
	userProfile        : null,
	invite             : null,
	teams              : [],
	mouse              : {
		position : {
			x : 0,
			y : 0
		},
		speed    : {
			x : 0,
			y : 0
		}
	}
};


const logFormat = (state, action, meta='')=> {
// 	const { type, payload } = action;
// 	console.log(LOG_REDUCER_PREFIX, `REDUCER >> “${type}”`, state, payload, meta);
};


function rootReducer(state=initialState, action) {
	logFormat(state, action);

	switch (action.type) {
		default:
			return (state);


		case ADD_FILE_UPLOAD:
			return (Object.assign({}, state, {
				file : action.payload
			}));

		case APPEND_ARTBOARD_SLICES:
			const { payload } = action;
			const { artboardID, slices } = payload;

			return (Object.assign({}, state, {
				uploadSlices : Object.assign({}, (state.uploadSlices.findIndex((artboard)=>
					(artboard.artboardID === artboardID)) > -1)
					? state.uploadSlices.filter((artboard)=> (artboard.artboardID === artboardID))
					: state.uploadSlices, { artboardID, slices })
			}));

		case APPEND_HOME_ARTBOARDS:
			return (Object.assign({}, state, {
				homeArtboards : (action.payload) ? state.homeArtboards.concat(action.payload).reduce((acc, inc)=>
					[...acc.filter(({ id })=> (id !== inc.id)), inc], []
				) : []
			}));

		case SET_ARTBOARD_COMPONENT:
			const { uuid, syntax, timestamp } = action.payload;

			return (Object.assign({}, state, {
				artboardComponents : {
					...state.artboardComponents,
					[uuid] : {
						syntax    : syntax,
						timestamp : timestamp
					}
				}
			}));

		case SET_ARTBOARD_GROUPS:
			return (Object.assign({}, state, {
				artboardGroups : action.payload
			}));

		case COMPONENT_TYPES_LOADED:
			return (Object.assign({}, state, {
				componentTypes : action.payload
			}));

		case EVENT_GROUPS_LOADED:
			return (Object.assign({}, state, {
				eventGroups : action.payload
			}));

		case SET_REDIRECT_URI:
			return (Object.assign({}, state, {
				redirectURI : action.payload
			}));

		case SET_INVITE:
			return (Object.assign({}, state, {
				invite : action.payload
			}));

		case UPDATE_MOUSE_COORDS:
			return (Object.assign({}, state, {
				mouse : Object.assign({}, state.mouse, {
					position : Object.assign({}, state.mouse.position, action.payload),
					speed    : {
						x : (state.mouse.position.x - action.payload.x),
						y : (state.mouse.position.y - action.payload.y),
					}
				})
			}));

		case USER_PROFILE_ERROR:
			return (Object.assign({}, state, {
				userProfile : action.payload
			}));

		case USER_PROFILE_LOADED:
			return (Object.assign({}, state, {
				userProfile : action.payload
			}));

		case USER_PROFILE_UPDATED:
			if (action.payload) {
				Objects.renameKey(action.payload, 'github_auth', 'github');
				if (action.payload.github) {
					Objects.renameKey(action.payload.github, 'access_token', 'accessToken');
				}

				const { id, type, github } = action.payload;
				return (Object.assign({}, state, {
					userProfile : { ...action.payload,
						id     : id << 0,
						github : (github) ? { ...github,
							id : github.id << 0
						} : github,
						paid   : /admin|paid/i.test(type)
					}
				}));

			} else {
				return (Object.assign({}, state, {
					userProfile : action.payload
				}));
			}

		case UPDATE_DEEPLINK:
			return (Object.assign({}, state, {
				deeplink : Object.assign({}, state.deeplink, action.payload)
			}));

		case SET_TEAMS:
			return (Object.assign({}, state, {
				teams : action.payload.slice(-1)
			}));
	}
}


export default rootReducer;
