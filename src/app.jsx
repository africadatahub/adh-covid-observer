import React from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import _ from 'lodash';
import * as URI from 'uri.js';
import './app.scss';

import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Button from 'react-bootstrap/Button';
import DropdownButton from 'react-bootstrap/DropdownButton';
import Dropdown from 'react-bootstrap/Dropdown';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';
import Form from 'react-bootstrap/Form';
import Spinner from 'react-bootstrap/Spinner';
import Placeholder from 'react-bootstrap/Placeholder';
import Modal from 'react-bootstrap/Modal';
import Accordion from 'react-bootstrap/Accordion';


import moment from 'moment';

import 'react-dates/initialize';
import { SingleDatePicker } from 'react-dates';
import 'react-dates/lib/css/_datepicker.css';

import getCountryISO2 from 'country-iso-3-to-2';
import ReactCountryFlag from 'react-country-flag';

import Nouislider from "nouislider-react";
import "nouislider/distribute/nouislider.css";

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faExclamationTriangle, faRedo, faPlay, faPause, faArrowLeft, faStepForward, faStepBackward, faInfo, faCalendarDay } from '@fortawesome/free-solid-svg-icons';

import { Header } from './components/Header';
import { RiskMap } from './components/RiskMap';
import { Leaderboard } from './components/Leaderboard';
import { CountryData } from './components/CountryData';

import * as countriesList from './data/countries.json';
import { CovidDataTable } from './components/CovidDataTable2';
import { faThemeisle } from '@fortawesome/free-brands-svg-icons';

export class App extends React.Component {


    constructor(){
        super();
        this.state = {
           
            api: {
                baseUrl: 'https://adhtest.opencitieslab.org/api/3/',
                resurgenceData: 'e8a1d3a5-f644-4f69-bd9c-bcc73e20c817',
                definitions: 'c070bdc8-59df-4d11-bc2d-cf0fa5e425fe',
                countryData: 'b2b6b48a-3685-4e1a-8d8c-8aab5bae3118' 

            },
            definitions: [],
            no_embed_style: {
                paddingTop: '20px'
            },
            error: false,
            loading: true,
            loadingComplete: false,
            showIntro: false,

            tab: 'map',

            data: [],
            dates: [],
            currentDate: '',
            daySelect: React.createRef(),
            monthSelect: React.createRef(),
            yearSelect: React.createRef(),
            currentDateCount: undefined,
            selectedDateData: [],
            selectedDateDataMap: [],
            playingTimeline: false,
            
            selectedCountries: [],
            ref: null,

            focused: false
            
        },
        this.playTimeline = this.playTimeline.bind(this);
        this.timer = undefined;
        
    }

    componentDidMount() {
        let self = this;

        if(window.location.search != '?embed') {

            let paddingTop = window.innerWidth >= 768 ? '100px' : '70px';

            self.setState({no_embed_style: { paddingTop: paddingTop }})
        }

       
        axios.get(self.state.api.baseUrl + 'action/datastore_search?resource_id=' + self.state.api.definitions + '&limit=200000')
        .then(function(response) {
            self.setState({definitions: response.data.result.records }); 
        })

        axios.get('https://adhtest.opencitieslab.org/api/3/action/datastore_search_sql?sql=SELECT%20*%20from%20"' + self.state.api.resurgenceData +'"%20WHERE%20date%20IN%20(SELECT%20max(date)%20FROM%20"' + self.state.api.resurgenceData +'")',
            { headers: {
                authorization: process.env.REACT_API_KEY
            }
        }).then(function(response) {
            self.setState({data: response.data.result.records});
            let dates = _.map(_.uniqBy(response.data.result.records, 'date'),'date');
            self.setState({
                dates: dates,
                loading: false,
                currentDate: dates[dates.length-1],
                currentDateCount: dates.length-1,
                selectedDateData: _.orderBy(self.state.data,['change'],['desc']),
                selectedDateDataMap: _.orderBy(_.filter(self.state.data, function(o) { return (o.date == dates[dates.length-1]) }),['change'],['desc'])
            });

            // self.state.ref.noUiSlider.set(10);
        }).catch(function(error) {
            console.log(error);
            self.setState({loading: false, error: true});
        })


        axios.get(self.state.api.baseUrl + 'action/datastore_search?resource_id=' + self.state.api.resurgenceData + '&include_total=true')
        .then(function(response) {

            let queries = [];

            for (let count = 0; count < Math.ceil(response.data.result.total / 32000); count++) {
                let offset = count > 0 ? '&offset=' + (count * 32000) : '';
                queries.push(self.state.api.baseUrl + 'action/datastore_search?resource_id=' + self.state.api.resurgenceData + '&limit=32000' + offset);
            }

            axios.all([axios.get(queries[0]), axios.get(queries[1])]).then(axios.spread((...responses) => {

                let data = [];

                for (let count = 0; count < responses.length; count++) {
                    let response = responses[count];
                    data = data.concat(response.data.result.records);
                }

                self.setState({
                    data: data
                });
               

                let dates = _.map(_.uniqBy(data, 'date'),'date');
                dates = _.orderBy(dates, [(date) => new Date(date)], ['asc']);


                self.setState({
                    dates: dates,
                    loading: false,
                    currentDate: dates[dates.length-1],
                    currentDateCount: dates.length-1,
                    selectedDateData: _.orderBy(_.filter(self.state.data, function(o) { return (o.date == dates[dates.length-1] && o.change != null && o.change != 'NaN') }),['change'],['desc']),
                    selectedDateDataMap: _.orderBy(_.filter(self.state.data, function(o) { return (o.date == dates[dates.length-1]) }),['change'],['desc'])
                });


    
    
                self.setState({loadingComplete: true});

                


                
            })).catch(error => {
                console.log(error);
                self.setState({loading: false, error: true});
            })

        })

      
    }

    componentDidUpdate() {
        let self = this;
        
    }

    

    onUpdate = (render, handle, value, un, percent) => {
        let self = this;

        // console.log('onUpdate()', this.state.dates[parseInt(value[0]-1)]);

        this.setState({
          currentDate: this.state.dates[parseInt(value[0]-1)],
          currentDateCount: parseInt(value[0]-1),
          selectedDateData: _.orderBy(_.filter(self.state.data, function(o) { return (o.date == self.state.dates[parseInt(value[0]-1)] && o.change != null && o.change != 'NaN') }),['change'],['desc']),
          selectedDateDataMap: _.orderBy(_.filter(self.state.data, function(o) { return (o.date == self.state.dates[parseInt(value[0]-1)]) }),['change'],['desc'])
        });
        


    }

    dateSelect = (e) => {
        let self = this;

        // let day = parseInt(this.state.daySelect.current.value) == 31 ? 31 : parseInt(this.state.daySelect.current.value) + 1;
        // let month = this.state.monthSelect.current.value;
        // let year = this.state.yearSelect.current.value;

        // console.log('dateSelect()', day,month,year);
        // let date = new Date(day + ' ' + month + ' ' + year).toISOString().split('T')[0];
        // date = date + 'T00:00:00';

        let date = moment(e._d).format("YYYY-MM-DD").toString() + 'T00:00:00';

        let dateCount = _.findIndex(self.state.dates, function(o) { return o == date; });

        if(dateCount > -1) {
            self.setState({
                currentDate: date,
                currentDateCount: dateCount,
                selectedDateData: _.orderBy(_.filter(self.state.data, function(o) { return (o.date == self.state.dates[dateCount] && o.change != null && o.change != 'NaN') }),['change'],['desc']),
                selectedDateDataMap: _.orderBy(_.filter(self.state.data, function(o) { return (o.date == self.state.dates[dateCount]) }),['change'],['desc'])
            });
        }

        self.state.ref.noUiSlider.set(self.state.currentDateCount);
        self.setState({focused: false});

        
    }

    togglePlayTimeline = () => {
        let self = this;
        self.setState(({ playingTimeline }) => ({ playingTimeline: !playingTimeline }));
        setTimeout(function() {
            if(self.state.playingTimeline == true) {
                self.playTimeline();
            } else {
                window.clearTimeout(self.timer);
            }
        },1000);
    }

    playTimeline = () => {
        let self = this;
        if (self.state.currentDateCount < self.state.dates.length-1) {
            self.setState({ currentDateCount: self.state.currentDateCount + 1 });
            self.setState({
                currentDate: self.state.dates[self.state.currentDateCount],
                selectedDateData: _.orderBy(_.filter(self.state.data, function(o) { return (o.date == self.state.dates[self.state.currentDateCount] && o.change != null && o.change != 'NaN') }),['change'],['desc']),
                selectedDateDataMap: _.orderBy(_.filter(self.state.data, function(o) { return (o.date == self.state.dates[self.state.currentDateCount]) }),['change'],['desc'])
            });
            self.state.ref.noUiSlider.set(parseInt(self.state.currentDateCount));
            self.timer = setTimeout( () => { self.playTimeline() }, 500 );
        } else {
            window.clearTimeout(self.timer);
            self.setState({playingTimeline: false});
        }

        
    }

    stepTimeline = (direction) => {
        let self = this;
        this.setState({
            currentDate: self.state.dates[direction == 'forward' ? self.state.currentDateCount + 1 : self.state.currentDateCount - 1],
            currentDateCount: direction == 'forward' ? self.state.currentDateCount + 1 : self.state.currentDateCount - 1,
            selectedDateData: _.orderBy(_.filter(self.state.data, function(o) { return (o.date == self.state.dates[direction == 'forward' ? self.state.currentDateCount + 1 : self.state.currentDateCount - 1] && o.change != null && o.change != 'NaN') }),['change'],['desc']),
            selectedDateDataMap: _.orderBy(_.filter(self.state.data, function(o) { return (o.date == self.state.dates[direction == 'forward' ? self.state.currentDateCount + 1 : self.state.currentDateCount - 1]) }),['change'],['desc'])
        });

        
        self.state.ref.noUiSlider.set(self.state.currentDateCount);
    }

    jumpToLatest = () => {
        let self = this;
        this.setState({
            currentDate: self.state.dates[self.state.dates.length-1],
            currentDateCount: self.state.dates.length,
            selectedDateData: _.orderBy(_.filter(self.state.data, function(o) { return (o.date == self.state.dates[self.state.dates.length-1] && o.change != null && o.change != 'NaN') }),['change'],['desc']),
            selectedDateDataMap: _.orderBy(_.filter(self.state.data, function(o) { return (o.date == self.state.dates[self.state.dates.length-1]) }),['change'],['desc'])
        });
        

        self.state.ref.noUiSlider.set(self.state.dates.length);
        
    }

    countrySelect = (country) => {
        let self = this;
        if(_.find(self.state.selectedCountries, function(o) { return o.iso_code == country.iso_code }) == undefined) {
            // self.setState({selectedCountries: [...self.state.selectedCountries, country]});
            self.setState({selectedCountries: [country]});
        }
    }

    selectedCountry = () => {
        let self = this;
        return this.state.selectedCountries.length == 0 ? 'Select Country' : this.state.selectedCountries[0].location
    }

    onDeselectCountry = () => {
        let self = this;
        self.setState({selectedCountries: []});

    }

    onModeSwitch = () => {
        let self = this;
        this.setState({
            selectedDateData: [],
            selectedDateDataMap: []
        });
        setTimeout(function() {
            self.setState({
                selectedDateData: _.orderBy(_.filter(self.state.data, function(o) { return (o.date == self.state.dates[self.state.currentDateCount] && o.change != null && o.change != 'NaN') }),['change'],['desc']),
                selectedDateDataMap: _.orderBy(_.filter(self.state.data, function(o) { return (o.date == self.state.dates[self.state.currentDateCount]) }),['change'],['desc'])
            });
        }, 500);
        
        self.state.ref.noUiSlider.set(self.state.currentDateCount);
    }

    switchTab() {
        let self = this;
        self.setState({tab: this.state.tab == 'map' ? 'datatable' : 'map'});
    }

    

    countryRemove = (country) => {
        let self = this;
        let selectedCountries = self.state.selectedCountries;
        let keepCountries = _.filter(selectedCountries, function(o) { return o.iso_code != country; });
        self.setState({selectedCountries: keepCountries});
    }

    render() {
        return (
            this.state.loading ? 
            <>
                <div className="position-absolute top-50 start-50 translate-middle text-center">
                    <Spinner animation="grow" />
                    <h3 className="mt-4">Loading</h3>
                </div>
            </> :
            this.state.error ?
            <>
                <div className="position-absolute top-50 start-50 translate-middle text-center">
                    <FontAwesomeIcon icon={faExclamationTriangle} size="5x"/>
                    <h3 className="mt-4">Error Fetching Data</h3>
                </div>
            </> :
            <>
                
                <div className="header pb-3">

                    { window.location.search != '?embed' ? <Header /> : '' }

                    { (window.innerWidth > 800) || (this.state.selectedCountries.length == 0 && window.innerWidth < 800) ? 
                       
                            <Container style={this.state.no_embed_style} className="justify-content-between">


                                { this.state.tab == 'map' ? 
                                    <>
                                        <Row className="mt-4 d-none d-md-block">
                                            <Col><h5>Select a country: </h5></Col>
                                        </Row>
                                        
                                            <>
                                                <Row className="mt-2 mb-4">

                                                    <Col xs="auto">

                                                        <DropdownButton title={this.selectedCountry()} className="country-select">
                                                            {countriesList.map((country,index) => (
                                                                <Dropdown.Item key={country.iso_code} onClick={() => this.countrySelect({iso_code: country.iso_code, location: country.location})}>
                                                                    <div style={{width: '1.5em', height: '1.5em', borderRadius: '50%', overflow: 'hidden', position: 'relative', display: 'inline-block'}} className="border">
                                                                        <ReactCountryFlag
                                                                        svg
                                                                        countryCode={getCountryISO2(country.iso_code)}
                                                                        style={{
                                                                            position: 'absolute', 
                                                                            top: '30%',
                                                                            left: '30%',
                                                                            marginTop: '-50%',
                                                                            marginLeft: '-50%',
                                                                            fontSize: '2em',
                                                                            lineHeight: '2em',
                                                                        }}/>
                                                                    </div>
                                                                    <div className="text-black d-inline-block ms-1" style={{position: 'relative', top: '-5px'}}>{country.location}</div>
                                                                </Dropdown.Item>
                                                            ))}
                                                        </DropdownButton>

                                                    </Col>
                                                    

                                                    <Col>
                                                        {/* <div className="d-none d-md-block">
                                                            {this.state.selectedCountries.map((country) => (
                                                                <Button variant="control-grey" key={country.iso_code} className="mx-1" onClick={() => this.countryRemove(country.iso_code)}>
                                                                    <Row>
                                                                        <Col xs="auto pe-0">
                                                                            <div style={{width: '1.5em', height: '1.5em', borderRadius: '50%', overflow: 'hidden', position: 'relative'}} className="border">
                                                                                <ReactCountryFlag
                                                                                svg
                                                                                countryCode={getCountryISO2(country.iso_code)}
                                                                                style={{
                                                                                    position: 'absolute', 
                                                                                    top: '30%',
                                                                                    left: '30%',
                                                                                    marginTop: '-50%',
                                                                                    marginLeft: '-50%',
                                                                                    fontSize: '2em',
                                                                                    lineHeight: '2em',
                                                                                }}/>
                                                                            </div>
                                                                        </Col>
                                                                        <Col className="text-start">{country.location}</Col>
                                                                        <Col xs="auto">
                                                                            <FontAwesomeIcon icon={faTimes} style={{ fontSize:"10px"}}/>
                                                                        </Col>
                                                                    </Row>
                                                                </Button>
                                                            ))}
                                                        </div> */}
                                                    </Col>

                                                
                                                
                                                    <Col xs="auto" className="align-self-center">
                                                        <div className="d-none d-md-block">
                                                            <Button className="me-1" size="md" variant={this.state.tab == 'map' ? 'primary' : 'control-grey'} onClick={() => this.switchTab() }>MAP</Button>
                                                            <Button size="md" variant={this.state.tab == 'datatable' ? 'primary' : 'control-grey'} onClick={() => this.switchTab() } className="me-3">DATATABLE</Button>
                                                        </div>
                                                        <div className="d-md-none">
                                                            <Button className="me-1" size="md" variant={this.state.showIntro == true ? 'primary' : 'control-grey'} onClick={() => this.setState({ showIntro: !this.state.showIntro }) }>About</Button>
                                                        </div>
                                                    </Col>
                                                </Row>

                                                <Modal show={this.state.showIntro} onHide={() => this.setState({showIntro: false})} centered>
                                                    <Modal.Header closeButton>
                                                        <Modal.Title>How it works</Modal.Title>
                                                    </Modal.Header>
                                                    <Modal.Body>
                                                        

                                                        <Accordion className="d-md-none mt-2">
                                                            {this.state.definitions.length > 0 ? 
                                                            <>
                                                                <Accordion.Item eventKey="0">
                                                                    <Accordion.Header>{_.filter(this.state.definitions, function(def) { return def.name == 'introductory_paragraph'})[0].title}</Accordion.Header>
                                                                    <Accordion.Body>
                                                                        <p className="text-black-50 mt-3">{_.filter(this.state.definitions, function(def) { return def.name == 'introductory_paragraph'})[0].text}</p>
                                                                    </Accordion.Body>
                                                                </Accordion.Item>
                                                                <Accordion.Item eventKey="1">
                                                                    <Accordion.Header>{_.filter(this.state.definitions, function(def) { return def.name == 'table_description'})[0].title}</Accordion.Header>
                                                                    <Accordion.Body>
                                                                        <p className="text-black-50 mt-3">{_.filter(this.state.definitions, function(def) { return def.name == 'table_description'})[0].text}</p>
                                                                    </Accordion.Body>
                                                                </Accordion.Item>
                                                            </>
                                                            : ''}
                                                        </Accordion>



                                                    </Modal.Body>
                                                </Modal>
                                            
                                            </>
                                        
                                    </>
                                :  
                                <div className="py-2">
                                    <Row>
                                        <Col></Col>
                                        <Col xs="auto" className="align-self-center">
                                            <Button className="me-1" size="md" variant={this.state.tab == 'map' ? 'primary' : 'control-grey'} onClick={() => this.switchTab() }>MAP</Button>
                                            <Button size="md" variant={this.state.tab == 'datatable' ? 'primary' : 'control-grey'} onClick={() => this.switchTab() } className="me-3">DATATABLE</Button>
                                        </Col>
                                    </Row>
                                </div>}


                                {this.state.selectedCountries.length > 0 && window.innerWidth < 800 ? ''  :
                                    
                                        this.state.tab == 'map' ?
                                            <Row>
                                                <Col xs="auto" lg={3}>
                                                    <h5 className="mt-1">Current date showing:</h5>
                                                    
                                                    <h1 className="cursor-pointer" style={{fontWeight: 500, fontSize: window.innerWidth < 1400 ? '2.2rem' : '2.2rem'}} onClick={() => this.setState({focused: true})}>
                                                        {
                                                            new Date(this.state.currentDate).toLocaleDateString(
                                                                'en-gb',
                                                                {
                                                                year: 'numeric',
                                                                month: 'long',
                                                                day: 'numeric'
                                                                }
                                                            )
                                                        } <FontAwesomeIcon icon={faCalendarDay} style={{ fontSize:"14px"}} color="#094151" className="cursor-pointer"/>
                                                    </h1>

                                                    <Modal show={this.state.focused} onHide={() => this.setState({focused: false})} centered>
                                                        <Modal.Header closeButton>
                                                            <Modal.Title>Pick a Date</Modal.Title>
                                                        </Modal.Header>
                                                        <Modal.Body style={{textAlign: 'center'}}>

                                                            <div className="datePicker1">
                                                                <SingleDatePicker
                                                                    date={moment(this.state.currentDate)} 
                                                                    onDateChange={(date) => this.dateSelect(date)} 
                                                                    focused={this.state.focused} 
                                                                    onFocusChange={({ focused }) => this.setState({ focused })} 
                                                                    id="datepicker" 
                                                                    isOutsideRange = {() => false}
                                                                    numberOfMonths={1}
                                                                    // withFullScreenPortal={window.innerWIdth < 800 ? true : false }
                                                                    keepOpenOnDateSelect
                                                                />
                                                            </div>

                                                        </Modal.Body>
                                                    </Modal>

                                                </Col>
                                                <Col lg={9}>
                                                    { this.state.loadingComplete ?
                                                    <>
                                                        <h5 className="mt-1">Scrub the timeline to change date:</h5>
                                                        <Row className="sticky-top">
                                                            <Col xs="auto">
                                                                <OverlayTrigger
                                                                placement="bottom"
                                                                overlay={<Tooltip>Play through entire timeline from current position.</Tooltip>}>
                                                                        <div>
                                                                        <Button variant="control-grey" onClick={() => this.togglePlayTimeline()} disabled={(this.state.currentDateCount == this.state.dates.length-1 || !this.state.loadingComplete) ? true : false}>
                                                                            <FontAwesomeIcon icon={ this.state.playingTimeline == true ? faPause : faPlay} color="#094151"/>
                                                                        </Button>
                                                                        </div>
                                                                    </OverlayTrigger>
                                                                </Col>
                                                                <Col>
                                                                    <Row className="gx-2">
                                                                        <Col xs="auto">
                                                                            <Button variant="control-grey" onClick={() => this.stepTimeline('back')} disabled={(this.state.currentDateCount == 0 || !this.state.loadingComplete) ? true : false}>
                                                                                <FontAwesomeIcon icon={faStepBackward} color="#094151"/>
                                                                            </Button>
                                                                        </Col>
                                                                        <Col>
                                                                            <div className="bg-control-grey px-4 h-100 rounded cursor-pointer"> 
                                                                                { this.state.dates.length > 0 ?
                                                                                <Nouislider
                                                                                    instanceRef={instance => {
                                                                                        if (instance && !this.state.ref) {
                                                                                        this.setState({ ref: instance });
                                                                                        }
                                                                                    }}
                                                                                    onSlide={this.onUpdate}
                                                                                    range={{ min: 1, max: this.state.dates.length > 1 ? this.state.dates.length : 10 }}
                                                                                    step={1}
                                                                                    start={[this.state.dates.length]}
                                                                                    connect={false}
                                                                                    pips= {{
                                                                                        mode: 'count',
                                                                                        values: 6,
                                                                                        density: 4,
                                                                                        stepped: true
                                                                                    }}
                                                                                />
                                                                                : ''}
                                                                            </div>
                                                                        </Col>
                                                                        <Col xs="auto">
                                                                            <Button variant="control-grey" onClick={() => this.stepTimeline('forward')} disabled={(this.state.currentDateCount == this.state.dates.length-1 || !this.state.loadingComplete) ? true : false}>
                                                                                <FontAwesomeIcon icon={faStepForward} color="#094151"/>
                                                                            </Button>
                                                                        </Col>
                                                                    </Row>
                                                                </Col>
                                                                <Col xs="auto">
                                                                    <OverlayTrigger
                                                                    placement="top"
                                                                    overlay={<Tooltip>Jump to most recent</Tooltip>}>
                                                                        <Button disabled={!this.state.loadingComplete} variant="control-grey" style={{height: '100%'}} onClick={this.jumpToLatest}>
                                                                            <FontAwesomeIcon icon={faRedo} color="#094151"/>
                                                                        </Button>
                                                                    </OverlayTrigger>
                                                                </Col>
                                                            </Row>
                                                        </>
                                                        : 
                                                            <>
                                                                <h5 className="mt-1">Loading historic data...</h5>
                                                                <Placeholder as="p" animation="glow">
                                                                    <Placeholder xs={12} size="lg"/>
                                                                </Placeholder>
                                                            </>
                                                        }
                                                        
                                                </Col>
                                            </Row>
                                        : ''
                                    
                                }
                                    

                            </Container>
                        
                        

                        
                    
                    : '' }
                 

                </div>
            
                

                { this.state.tab == 'map' ? 
                    <Container className="my-4">
                        <Row>
                            {this.state.selectedCountries.length > 0 && window.innerWidth < 800 ? '' :
                                <Col lg={6} className="mb-4">
                                    {this.state.definitions.length > 0 ?
                                        <RiskMap onCountrySelect={this.countrySelect} data={this.state.selectedDateDataMap} onModeSwitch={this.onModeSwitch} definitions={this.state.definitions}/>
                                    : '' }
                                </Col>
                            }
                            <Col>
                                { 
                                    this.state.selectedCountries.length > 0 ? 
                                        <CountryData selectedCountries={this.state.selectedCountries} onDeselectCountry={this.onDeselectCountry} definitions={this.state.definitions}api={this.state.api}/> 
                                    :
                                        <>
                                            {this.state.definitions.length > 0 ?
                                                <Leaderboard data={this.state.selectedDateData} onCountrySelect={this.countrySelect} playingTimeline={this.state.playingTimeline} definitions={this.state.definitions}/>
                                            : '' }
                                        </>
                                }
                            </Col>
                        </Row>
                    </Container>
                :
                    <Container className="my-4" fluid>
                        <Row>
                            <Col>
                                <CovidDataTable currentDate={this.state.currentDate} api={this.state.api} />
                            </Col>
                        </Row>
                    </Container>
                }
            </>)
        
    }

}


const container = document.getElementsByClassName('app')[0];

ReactDOM.render(React.createElement(App), container);