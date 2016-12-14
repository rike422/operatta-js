import React, { PropTypes } from 'react'
import Title from 'grommet/components/Title'
import Box from 'grommet/components/Box'
import Anchor from 'grommet/components/Anchor'
import Columns from 'grommet/components/Columns'
import Header from 'grommet/components/Header'
import NextIcon from 'grommet/components/icons/base/CaretNext'
import PrevIcon from 'grommet/components/icons/base/CaretPrevious'
import CodeIcon from 'grommet/components/icons/base/Code'

export default class EditorMenu extends React.Component {

  propTypes: {
    onRedo: PropTypes.func.isRequired,
    onUndo: PropTypes.func.isRequired,
    onCodeClick:  PropTypes.func.isRequired
  }

  render () {
    const {
      onRedo,
      onUndo,
      onCode
    } = this.props

    return (
      <Header
        splash={false}
        float={false}
        fixed={false}
        size="medium">
        <Title>
          Sample Title
        </Title>
        <Columns
          masonry={false}
          size="small"
          justify="center"
          responsive={false}
          maxCount={4}>
          <Box>
            <Anchor
              icon={<PrevIcon />}
              label="Undo"
              onClick={onRedo}
              secondary={false} />
          </Box>
          <Box>
            <Anchor
              icon={<NextIcon />}
              label="Redo"
              onClick={onRedo}
              secondary={false} />
          </Box>
          <Box>
            <Anchor
              icon={<CodeIcon />}
              label="code"
              onClick={onCode}
              secondary={false} />
          </Box>
        </Columns>
      </Header>
    )
  }
}
