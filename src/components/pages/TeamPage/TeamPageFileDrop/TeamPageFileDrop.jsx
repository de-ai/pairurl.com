
import React, { Component } from 'react';
import './TeamPageFileDrop.css';

import axios from 'axios';
import FilePondPluginImageExifOrientation from 'filepond-plugin-image-exif-orientation';
import FilePondPluginImagePreview from 'filepond-plugin-image-preview';
import { URIs } from 'lang-js-utils';
import TextareaAutosize from 'react-autosize-textarea';
import { FilePond, registerPlugin } from 'react-filepond';
import { connect } from 'react-redux';
import { makeComment } from '../../../../redux/actions';
import btnCode from '../../../../assets/images/ui/btn-code.svg';

import 'filepond/dist/filepond.min.css';
import 'filepond-plugin-image-preview/dist/filepond-plugin-image-preview.css';
import './post-styles.css';

import { API_ENDPT_URL, CDN_FILEPOND_URL } from '../../../../consts/uris';

registerPlugin(FilePondPluginImageExifOrientation, FilePondPluginImagePreview);


class TeamPageFileDrop extends Component {
	constructor(props) {
		super(props);

		this.state = {
      text     : '',
      image    : null,
      loading  : false,
      uploaded : false,
      url      : false,
      code     : false,
      files    : []
		};
  }

  dataURIFile = (dataURI, filename)=> {
    console.log('%s.dataURIFile()', this.constructor.name, {dataURI, filename });

    fetch(dataURI).then((res)=>(res.arrayBuffer())).then((res)=> {
      const file = new File([res], filename, { type : 'image/png' });
      this.setState({ files : [ ...this.state.files, file] });
    });
  };

  componentDidMount() {
    // console.log('%s.componentDidMount()', this.constructor.name, { props : this.props, state : this.state });
  }

	componentDidUpdate(prevProps, prevState, snapshot) {
    console.log('%s.componentDidUpdate()', this.constructor.name, { prevProps, props : this.props, prevState, state : this.state });

    const { imageURL, dataURI, textContent } = this.props;
    // if (dataURI && !this.state.image && !prevState.image) {
    //   this.setState({
    //     url   : true,
    //     image : dataURI,
    //   }, ()=> {
    //     this.dataURIFile(dataURI, `${URIs.lastComponent(imageURL)}.png`);
    //   });
    // }

    if (textContent !== '' && textContent !== this.state.text && this.state.text === '') {
      const urlComment = (/https?:\/\//i.test(textContent));

      this.setState({
        text : textContent,
        url  : urlComment
      }, ()=> {
        if (urlComment) {
          this.onFetchScreenshot(textContent);
        }
      });
    }

    const { text } = this.state;
    if (prevState.text !== text) {

    }
  }


  handleInit() {
    console.log('FilePond instance has initialised');
  };

  handleCode = (event)=> {
    console.log('%s.handleCode()', this.constructor.name, { event });
    this.setState({ code : !this.state.code });
  };

  handleResetFiles = (event)=> {
    console.log('%s.handleResetFiles(event)', this.constructor.name, { event });
    this.setState({
      text     : '',
      image    : null,
      loading  : false,
      uploaded : false,
      url      : false,
      code     : false,
      files    : []
    }, ()=> {
      this.props.onClose();
    });
  }

  handleFileInit = (file)=> {
    console.log('%s.handleFileInit(file)', this.constructor.name, { file });
  };


  // processes the first file
  handleFileAdd = (file)=> {
    console.log('%s.handleFileAdd(file)', this.constructor.name, { file });
    // File has been processed
  };

  handleFileProgress = (file, progress)=> {
    console.log('%s.handleFileProgress(file, progress)', this.constructor.name, { file, progress });
  };

  handleFileProcessStart = (file)=> {
    console.log('%s.handleFileProcessStart(file)', this.constructor.name, { file });
    this.setState({
      loading  : true,
      uploaded : false
    });
  };

  handleFileProcessProgress = (file, progress)=> {
    console.log('%s.handleFileProcessProgress(file, progress)', this.constructor.name, { file, progress });
  };

  handleProcessedFile = (error, file)=> {
    console.log('%s.handleProcessedFile(error, output)', this.constructor.name, { error, file });
    this.setState({
      loading  : false,
      uploaded : true
    });
  };

  handleProcessedFiles = ()=> {
    console.log('%s.handleProcessedFiles()', this.constructor.name);
  };

  handleFileRemoved = (error, output)=> {
    console.log('%s.handleFileRemoved(error, output)', this.constructor.name, { error, output });

    this.handleResetFiles();
  };

  // // processes the first file
  handleFileWarning = (error, file, status)=> {
    console.log('%s.handleFileWarning(error, file, status)', this.constructor.name, { error, file, status });
    // File has been processed
  };

  // processes the first file
  handleFileError = (error, file, status) => {
    console.log('%s.handleFileError(error, file, status)', this.constructor.name, { error, file, status });
    // File has been processed
  };

  handleFilesUpdated = (fileItems)=> {
    console.log('%s.handleFilesUpdated(fileItems)', this.constructor.name, { fileItems });
    this.setState({ files : fileItems.map(({ file })=> (file)) }, ()=> {
      // this.props.onClose();
    });
  }

  /* handleFilePond = ()=> {
    console.log('%s.()', this.constructor.name, { ,  });
  }; */

  handleTextChange = (event)=> {
    console.log('%s.handleTextChange()', this.constructor.name, { event, state : this.state });

    const text = event.target.value;
    const urlComment = (/https?:\/\//i.test(text));

    this.setState({ text,
      url : urlComment,
    }, ()=> {
      if (urlComment) {
        this.onFetchScreenshot(text);
      }
    });
  };

  handleSubmit = (event)=> {
    console.log('%s.handleSubmit(event)', this.constructor.name, { event });
    event.preventDefault();
    event.stopPropagation();

    const { text, image, code } = this.state;
    this.props.makeComment({ image,
      comment  : null,
			content  : text,
      position : null,
      format   : (code) ? 'code' : 'text'
    });

    this.handleResetFiles();
  };

  onFetchScreenshot = (text)=> {
    console.log('%s.onFetchScreenshot(text)', this.constructor.name, { text });

    const url = text.match(/https?:\/\/.+ ?/i).shift().split(' ').shift();
    axios.post(API_ENDPT_URL, {
      action  : 'SCREENSHOT_URL',
      payload : { url }
    }).then((response)=> {
      const { image } = response.data;
      console.log('SCREENSHOT_URL', { data : response.data });
      this.setState({
        image : image.cdn
      }, ()=> {
        this.dataURIFile(image.data, URIs.lastComponent(image.src));
      });
    });
  };


	render() {
    // console.log('%s.render()', this.constructor.name, { props : this.props, state : this.state });


    const { team, profile, dragging } = this.props;
    const { text, url, code, uploaded, image, files } = this.state;

		return (<div className="team-page-file-drop" data-hidden={(!dragging && files.length === 0 && text.length === 0)}>
      <div data-file={files.length > 0 || image !== null || text.length > 0}>
        {(files.length > 0 || text.length > 0) && (<div className="input-wrapper" data-uploaded={uploaded}>
          <div>
            {(text.length > 0 && !url) && (<img src={btnCode} className="code-btn" onClick={this.handleCode} alt="Code" />)}
            <TextareaAutosize className="comment-txt" placeholder={`Add a comment to this${(url) ? ' url' : ' image'}…`} value={text} onChange={this.handleTextChange} data-code={(code)} />
          </div>
          <button type="submit" disabled={false} onClick={this.handleSubmit}>Submit</button>
        </div>)}

        <FilePond
          server={{
            url     : CDN_FILEPOND_URL,
            process : {
              url : './index.php'
            }
          }}
          // ref={ref => (this.pond = ref)}
          files={files}
          className="file-pond-wrapper"
          allowMultiple={true}
          maxFiles={3}
          allowReorder={false}
          allowReplace={true}
          allowRevert={true}
          // appendTo={filePondAttach}
          itemInsertLocation="after"
          instantUpload={true}
          labelIdle=""
          // iconRemove={null}
          labelFileProcessingComplete=""
          labelTapToUndo=""
          oninit={this.handleInit}
          onwarning={this.handleFileWarning}
          onerror={this.handleFileError}
          oninitfile={this.handleFileInit}
          onaddfile={this.handleFileAdd}
          onaddfileprogress={this.handleFileProgress}
          onprocessfilestart={this.handleFileProcessStart}
          onprocessfileprogress={this.handleFileProcessProgress}
          onprocessfile={this.handleProcessedFile}
          onprocessfiles={this.handleProcessedFiles}
          onremovefile={this.handleFileRemoved}
          onupdatefiles={this.handleFilesUpdated}

          // onupdatefiles={(fileItems)=> {
          //   console.log('%s.onupdatefiles()', this.constructor.name, { fileItems });
          //   this.setState({ files: fileItems.map(fileItem => fileItem.file) });
          // }}
        />
      </div>
      <AddContentCloseButton onCloseClick={this.handleResetFiles} />
    </div>);
	}
}


const AddContentCloseButton = (props)=> {
  // console.log('AddContentCloseButton()', { props });

  return (<button className="quiet-button glyph-button" onClick={props.onCloseClick}>
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="16" fill="#EAEAEA"/>
      <rect x="9.63623" y="11.0503" width="2" height="16" transform="rotate(-45 9.63623 11.0503)" fill="white"/>
      <rect x="20.9502" y="9.63599" width="2" height="16" transform="rotate(45 20.9502 9.63599)" fill="white"/>
    </svg>
  </button>);
};

const mapDispatchToProps = (dispatch)=> {
  return ({
    makeComment : (payload)=> dispatch(makeComment(payload)),
  });
};

const mapStateToProps = (state, ownProps)=> {
	return ({
    profile : state.user.profile,
    team    : state.teams.team
	});
};


export default connect(mapStateToProps, mapDispatchToProps)(TeamPageFileDrop);