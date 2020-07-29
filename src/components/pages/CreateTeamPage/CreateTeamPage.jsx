
import React from 'react';
import './CreateTeamPage.css';
import { connect } from 'react-redux';
import { withRouter } from 'react-router-dom';

import BasePage from '../BasePage';
import CreateTeamForm from '../../forms/CreateTeamForm';
import { makeTeam } from '../../../redux/actions';

function CreateTeamPage(props) {

  const { profile } = props;
  return (<BasePage { ...props } className="create-team-page">
		{(profile) && (<CreateTeamForm onSubmit={props.makeTeam} onCancel={props.history.goBack} />)}
	</BasePage>);
}


const mapDispatchToProps = (dispatch)=> {
  return ({
    makeTeam : (payload)=> dispatch(makeTeam(payload))
  });
};

const mapStateToProps = (state, ownProps)=> {
  return ({
    profile : state.user.profile
  });
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(CreateTeamPage));
