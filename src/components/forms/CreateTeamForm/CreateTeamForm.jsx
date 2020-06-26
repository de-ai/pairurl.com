
import React, { Component } from 'react';
import './CreateTeamForm.css';

import TextareaAutosize from 'react-autosize-textarea';


class CreateTeamForm extends Component {
  constructor(props) {
    super(props);

    this.state = {
      title       : '',
      description : null,
      rules       : [],
      invites     : [],
      changed     : false,
      validated   : false
    };
  }

  componentDidMount() {
    console.log('%s.componentDidMount()', this.constructor.name, { props : this.props, state : this.state });
  }

  componentDidUpdate(prevProps, prevState, snapshot) {
    console.log('%s.componentDidUpdate()', this.constructor.name, { prevProps, props : this.props, prevState, state : this.state });
  }

  /* handleFilePond = ()=> {
    console.log('%s.()', this.constructor.name, {  });
  }; */

  handleCancel = (event)=> {
    console.log('%s.handleCancel()', this.constructor.name, { event });
    this.props.onCancel();
  };


  render() {
    console.log('%s.render()', this.constructor.name, { props : this.props, state : this.state });

    const { profile, team } = this.props;
    const { title, description, rules, invites, changed, validated } = this.state;

    return (<div className="create-team-form">
      <form onSubmit={this.handleSubmit}>
        <input type="text" placeholder="Team title" value={title} onChange={this.handleTitleChange} autoComplete="new-password" />
        <input type="text" placeholder="Team description" value={description} onChange={this.handleDescriptionChange} autoComplete="new-password" />
        <TextareaAutosize className="rules-txt" placeholder="Team rules (one per line)" value={rules.join('\n')} onChange={this.handleRulesChange} />
        <TextareaAutosize className="invites-txt" placeholder="Invites (space separated emails)" value={invites.join(' ')} onChange={this.handleInvitesChange} />
				{/* <button disabled={(emails.filter((email)=> (email.length === 0)).length === emails.length || emailsValid.filter((valid)=> (!valid)).length === emailsValid.length)} type="submit" onClick={(event)=> this.handleSubmit(event)}>Invite Team</button> */}
				<button type="button" className="quiet-button" onClick={this.handleCancel}>Cancel</button>
				<button type="submit" onClick={this.handleSubmit}>Create Team</button>
			</form>
    </div>);
  }
}

export default (CreateTeamForm);
