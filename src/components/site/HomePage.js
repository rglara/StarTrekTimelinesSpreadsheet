import React from 'react';

import { Container, Header, Divider, Grid, Button, Icon, List, Label, Form, Message } from 'semantic-ui-react';

import STTApi from '../../api';

export class HomePage extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            errorMessage: null,
            autoLogin: true,
            showSpinner: false,
            agreePolicy: false,
            username: '',
            password: ''
        };

        this._closeDialog = this._closeDialog.bind(this);
    }

    render() {
        return <Container text>
            <Header as='h1' dividing>IAmPicard's Star Trek Timelines tools</Header>
            <p>Companion tools for the <a href="https://www.disruptorbeam.com/games/star-trek-timelines/" target='_blank'>Star Trek Timelines</a> game</p>

            <Header as='h3'>Online version of the tool <span style={{ color: 'red' }}>- BETA</span></Header>

            <Message attached>
                Login below using your Start Trek Timelines username and password. If you're using Facebook, Steam or a mobile platform and have yet to set up your account, please see instructions <a href='https://startrektimelines.zendesk.com/hc/en-us/articles/215687778-How-do-I-register-my-Star-Trek-Timelines-account-' target='_blank'>here</a>.
            </Message>
            <Form className='attached fluid segment' loading={this.state.showSpinner} onSubmit={this._closeDialog}>
                <Form.Input label='Username' placeholder='Username (e-mail)' type='text' value={this.state.username} onChange={(e, d) => { this.setState({ username: d.value }) }} />
                <Form.Input label='Password' type='password' value={this.state.password} onChange={(e, d) => { this.setState({ password: d.value }) }} />
                <Form.Checkbox inline checked={this.state.agreePolicy} onChange={(e, d) => { this.setState({ agreePolicy: d.checked }) }} label={<label>I have read and agree to the <a href='https://github.com/IAmPicard/StarTrekTimelinesSpreadsheet#privacy-and-security' target='_blank' >Privacy Policy</a></label>} />
                <Button color='blue' disabled={this.state.showSpinner || !this.state.agreePolicy}>Login</Button>
            </Form>
            <Message attached='bottom' error hidden={!this.state.errorMessage}>
                {this.state.errorMessage}
            </Message>

            <Header as='h3'><span className='blinking_thing'>NEW!</span> Self-updating crew stats tool <span style={{ color: 'red' }}>- VERY BETA (PRE-ALPHA)</span></Header>
            <p>You don't need to log in to see crew stats; this information is self-updating and comes from DB itself, not wikis or spreadsheets. That means there is no chance of human error.</p>
            <p><i>How does it work?</i> This data is using cached immortal stats from users of the online tool (see below). I'm keeping that data to speed up load times (and to reduce load on DB's servers), so I might as well put it to good use for the community. A newly added crew usually shows up in the database in a couple of hours.</p>
            <p>Check it out on the crew stats page.</p>

            <Divider />

            <Header as='h3'>Miscellaneous links</Header>
            <List>
                <List.Item icon='linkify' content={<a href="https://www.disruptorbeam.com/games/star-trek-timelines/" target='_blank'>Official game page</a>} />
                <List.Item icon='linkify' content={<a href="https://forum.disruptorbeam.com/stt/" target='_blank'>Official game forums</a>} />
                <List.Item icon='linkify' content={<a href="https://stt.wiki/wiki/Main_Page" target='_blank'>Wiki (player contributed, lots of useful info)</a>} />
                <List.Item icon='linkify' content={<a href="https://discord.gg/8Du7ZtJ" target='_blank'>Discord channel</a>} />
                <List.Item icon='linkify' content={<a href="https://www.reddit.com/r/StarTrekTimelines/" target='_blank'>Subreddit</a>} />
            </List>

            <br />
            <Label size="small"><b>DISCLAIMER</b> This tool is provided "as is", without warranty of any kind. Use at your own risk! It should be understood that Star Trek Timelines content and materials are trademarks and copyrights of <a href='https://www.disruptorbeam.com/tos/' target='_blank'>Disruptor Beam, Inc.</a> or its licensors. All rights reserved. This tool is neither endorsed by nor affiliated with Disruptor Beam, Inc..</Label>
        </Container>;
    }

    _closeDialog() {
        this.setState({ showSpinner: true, errorMessage: null });

        let promiseLogin = STTApi.login(this.state.username, this.state.password, this.state.autoLogin, true);

        promiseLogin.then(() => {
            this.setState({ showSpinner: false });
            this.props.onAccessToken();
        })
            .catch((error) => {
                console.error(error);
                this.setState({ showSpinner: false, errorMessage: error.message });
            });
    }
}