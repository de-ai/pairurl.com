
import axios from 'axios/index';
import cookie from 'react-cookies';

import { hasBit } from '../../utils/funcs';
import { ADD_ARTICLE, APPEND_EXPLORE_ARTBOARDS, USER_PROFILE_ERROR, USER_PROFILE_LOADED, USER_PROFILE_UPDATED } from '../../consts/action-types';


export function addArticle(payload) {
	return ({ type : ADD_ARTICLE, payload });
}

export function appendExploreArtboards(payload) {
	return ({ type : APPEND_EXPLORE_ARTBOARDS, payload });
}

export function fetchUserProfile() {
	return (function(dispatch) {
		let formData = new FormData();
		formData.append('action', 'PROFILE');
		formData.append('user_id', cookie.load('user_id'));
		axios.post('https://api.designengine.ai/system.php', formData)
			.then((response)=> {
				console.log('fetchUserProfile()=> PROFILE', response.data);
				dispatch({
					type    : USER_PROFILE_LOADED,
					payload : response.data
				});
			}).catch((error) => {
		});

// 	return (
// 		fetch('https://api.designengine.ai/system.php', {
// 			method : 'post',
// 			body   : {
// 				'action'  : 'PROFILE',
// 				'user_id' : cookie.load('user_id')
// 			}
// 		})
// 			.then((response)=> response.json())
// 			.then((json)=> {
// 				return ({ type : 'USER_PROFILE_LOADED', payload : json });
// 			})
// 	);
	});
}

export function updateUserProfile(payload) {
	return (function(dispatch) {
		let formData = new FormData();
		formData.append('action', 'UPDATE_PROFILE');
		formData.append('user_id', cookie.load('user_id'));
		formData.append('username', payload.username);
		formData.append('email', payload.email);
		formData.append('filename', payload.avatar);
		formData.append('password', payload.password);
		axios.post('https://api.designengine.ai/system.php', formData)
			.then((response) => {
				console.log('updateUserProfile()=> UPDATE_PROFILE', response.data);

				const status = parseInt(response.data.status, 16);
				if (status === 0x00) {
					const { avatar, username, email } = response.data.user;
					dispatch({
						type    : USER_PROFILE_UPDATED,
						payload : {
							status   : status,
							avatar   : avatar,
							username : username,
							email    : email
						}
					});

				} else {
					dispatch({
						type    : USER_PROFILE_ERROR,
						payload : {
							status   : status,
							avatar   : payload.avatar,
							username : (hasBit(status, 0x01)) ? 'Username Already in Use' : payload.user,
							email    : (hasBit(status, 0x10)) ? 'Email Already in Use' : payload.email,
						}
					});
				}
			}).catch((error) => {
		});
	});
}
