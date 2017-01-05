import React, { PropTypes } from 'react'
import Box from 'grommet/components/Box';
import Codemirror from 'react-codemirror'
import EditorMenu from './editor-menu'
import { EditorClient, SocketIOClient, CodeMirrorAdapter } from '../lib/index'
import io from 'socket.io-client'
function beginsWith (a, b) { return a.slice(0, b.length) === b; }
function endsWith (a, b) { return a.slice(a.length - b.length, a.length) === b; }

export default class Editor extends React.Component {

  static propTypes = {
    content: PropTypes.string,
  };

  static defaultProps = {
    content: 'body!'
  }

  constructor (props, context) {
    super(props, context);
    this.state = {}
  }

  onBoldclick () {
    this.wrap('**')
  }

  onUndo () {
    this.state.editor.cm.redo();
    this.state.editor.cm.focus();
  }

  onRedo () {
    this.state.editor.cm.undo();
    this.state.editor.cm.focus();
  }

  onItalicClick () {
    this.wrap('*');
  }

  onCodeClick () {
    this.wrap('`')
  }

  onChange (str) {
    this.props.dispatch('updateMd', str)
  }

  wrap (chars) {
    const cm = this.state.editor.cm
    cm.operation(() => {
      if (cm.somethingSelected()) {
        cm.replaceSelections(cm.getSelections().map(selection => {
          if (beginsWith(selection, chars) && endsWith(selection, chars)) {
            return selection.slice(chars.length, selection.length - chars.length);
          }
          return chars + selection + chars;
        }), 'around');
      } else {
        const index = cm.indexFromPos(cm.getCursor());
        cm.replaceSelection(chars + chars);
        cm.setCursor(cm.posFromIndex(index + 2));
      }
    });
    cm.focus();
  }

  componentDidMount () {
    if (navigator) {

      const cm = this.refs.editor.getCodeMirror();
      const cmAdapter = new CodeMirrorAdapter(cm)
      this.setState({ editor: cmAdapter })
      const socket = io(window.location.origin);
      socket.on("doc", (data) => {
        const { str, revision, clients } = data;
        cm.setValue(str);
        this.onChange(str)
        this.setState({
          client: new EditorClient(
            revision, clients, new SocketIOClient(socket), cmAdapter
          )
        })
      })
      require('codemirror/mode/javascript/javascript');
      require('codemirror/mode/xml/xml');
      require('codemirror/mode/markdown/markdown');
    }
  }

  render () {
    const option = {
      lineNumbers: true,
      lineWrapping: true,
      mode: 'markdown'
    }
    return (
      <Box>
        <EditorMenu onRedo={this.onRedo.bind(this)} onUndo={this.onUndo.bind(this)} onCode={this.onCodeClick.bind(this)} />
        <Codemirror value={this.state.code} options={option} ref="editor" onChange={this.onChange.bind(this)} />
      </Box>
    )
  }
}
