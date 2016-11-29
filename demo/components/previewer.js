import React, { PropTypes } from 'react'
import ReactMarkdown from 'react-markdown'

export default class Previewer extends React.Component {

  render () {
    return (
      <div>
        <h2>
          Preview:
        </h2>
        <div id="preview">
          <ReactMarkdown
            source={ this.props.md }
            skipHtml={ true }
            escapeHtml={ true }
          />
        </div>
      </div>
    )
  }
}
