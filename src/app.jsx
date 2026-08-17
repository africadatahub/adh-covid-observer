import React from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import _ from 'lodash';
import './app.scss';

import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Button from 'react-bootstrap/Button';
import DropdownButton from 'react-bootstrap/DropdownButton';
import Dropdown from 'react-bootstrap/Dropdown';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';
import Spinner from 'react-bootstrap/Spinner';
import Placeholder from 'react-bootstrap/Placeholder';
import Modal from 'react-bootstrap/Modal';
import Accordion from 'react-bootstrap/Accordion';
import Form from 'react-bootstrap/Form'

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
import { CaseMap } from './components/CaseMap';
import { Leaderboard } from './components/Leaderboard';
import { CountryData } from './components/CountryData';

import * as countriesList from './data/countries.json';
import { CovidDataTable } from './components/CovidDataTable';

import * as texts from './data/texts.json';


export class App extends React.Component {


    constructor(){
        super();
        this.state = {
           
            api: {
                url: {
                    dev: 'https://ckandev.africadatahub.org/api/3/',
                    prod: 'https://ckan.africadatahub.org/api/3/'
                },
                data: {
                    owid: {
                        dev: {
                            caseData: '9cdc672f-7e1e-4d40-91e2-be0d9989c759',
                            countryData: '65a5b80d-b57a-43d4-bf9c-20cafddc7d60'
                        },
                        // prod: {
                        //     caseData: 'c7c03399-021e-4339-ad9d-93aee8aa950a',
                        //     countryData: 'b2b6b48a-3685-4e1a-8d8c-8aab5bae3118',
                        //     definitions: 'c070bdc8-59df-4d11-bc2d-cf0fa5e425fe'
                        // },
                        prod: {
                            caseData: '72da1306-e970-4398-9f1a-2a65beeb960e',
                            countryData: '0509abb8-fb51-4b4d-a9e9-90eb33cf2cdc'
                        }
                    },
                    acdc: {
                        // dev: {
                        //     caseData: '75e4ca59-8971-41f6-a54b-e182297685fa',
                        //     countryData: '1b14898d-d74c-4eb5-a97d-fd45e3f36c49'
                        // },
                        prod: {
                            caseData: '1b16284b-8fbf-46c7-b940-99e7fdbb8a3e',
                            countryData: 'f283fdbb-cb46-427f-8fb8-0875c0e659f6'
                        }
                        
                    }
                },
                dataset: 'owid',
                env: 'prod'
            },

            no_embed_style: {
                paddingTop: '20px'
            },
            error: false,
            loading: true,
            loadingComplete: false,
            loggedIn: false,

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

            selectedBaseMetric: 'new_cases_smoothed',
            update: 0,

            focused: false
            
        },
        this.playTimeline = this.playTimeline.bind(this);
        this.timer = undefined;
        
    }

    componentDidMount() {
        let self = this;

        if(document.URL.indexOf('?embed') == -1) {

            let paddingTop = window.innerWidth >= 768 ? '100px' : '70px';

            self.setState({no_embed_style: { paddingTop: paddingTop }})
        }

        if(document.URL.indexOf('acdc') > -1) {

            let api = self.state.api;
            api.dataset = 'acdc';
            api.env = 'prod';

            self.setState({api: api});
        } else {

            self.setState({loggedIn: true});
        
        }


        // Fetch data for the latest date...
        axios.get(self.state.api.url[self.state.api.env] + 'action/datastore_search_sql?sql=SELECT%20*%20from%20"' + self.state.api.data[self.state.api.dataset][self.state.api.env].caseData +'"%20WHERE%20date%20IN%20(SELECT%20max(date)%20FROM%20"' + self.state.api.data[self.state.api.dataset][self.state.api.env].caseData +'")',
            { headers: {
                "Authorization": self.state.api.env == 'dev' ? process.env.CKANDEV : process.env.CKAN
            }
        }).then(function(response) {
            self.setState({data: response.data.result.records});
            let dates = _.map(_.uniqBy(response.data.result.records, 'date'),'date');
            self.setState({
                dates: dates,
                loading: false,
                currentDate: dates[dates.length-1],
                currentDateCount: dates.length-1,
                selectedDateData: _.orderBy(_.filter(self.state.data, function(o) { return (o.date == dates[dates.length-1]) }),[self.state.selectedBaseMetric],['desc']),
                selectedDateDataMap: _.orderBy(_.filter(self.state.data, function(o) { return (o.date == dates[dates.length-1]) }),[self.state.selectedBaseMetric],['desc']),
                update: self.state.update + 1
            });

            // self.state.ref.noUiSlider.set(10);
        }).catch(function(error) {
            console.log(error);
            self.setState({loading: false, error: true});
        })
       
        //  CKAN returns a max of 32000 rows. Find out how many row there are in the entire set.

        axios.get(self.state.api.url[self.state.api.env] + 'action/datastore_search?resource_id=' + self.state.api.data[self.state.api.dataset][self.state.api.env].caseData + '&include_total=true',
            { headers: {
                "Authorization": self.state.api.env == 'dev' ? process.env.CKANDEV : process.env.CKAN
                }
        }).then(function(response) {

            // Do queries in increments of 32000

            let queries = [];

            for (let count = 0; count < Math.ceil(response.data.result.total / 32000); count++) {
                let offset = count > 0 ? '&offset=' + (count * 32000) : '';
                queries.push(self.state.api.url[self.state.api.env] + 'action/datastore_search?resource_id=' + self.state.api.data[self.state.api.dataset][self.state.api.env].caseData + '&limit=32000' + offset);
            }

            let queries_get = [];

            for (let query = 0; query < queries.length; query++) {
                
                queries_get.push(axios.get(queries[query],{ headers: {"Authorization": self.state.api.env == 'dev' ? process.env.CKANDEV : process.env.CKAN}}))

            }

            // We're manually setting this now - this is not good and needs to be reworked.

            axios.all(queries_get).then(axios.spread((...responses) => {

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
                    selectedDateData: _.orderBy(_.filter(self.state.data, function(o) { return (o.date == dates[dates.length-1]) }),[self.state.selectedBaseMetric],['desc']),
                    selectedDateDataMap: _.orderBy(_.filter(self.state.data, function(o) { return (o.date == dates[dates.length-1]) }),[self.state.selectedBaseMetric],['desc']),
                    update: self.state.update + 1
                });
    
                self.setState({loadingComplete: true});
                
            })).catch(error => {
                console.log(error);
                self.setState({loading: false, error: true});
            })

        }).catch(function(error) {
            console.log(error);
            self.setState({loading: false, error: true});
        })
    }
   

    CSVToJSON = csv => {
        const lines = csv.split('\n');
        const keys = lines[0].split(',');
        return lines.slice(1).map(line => {
            return line.split(',').reduce((acc, cur, i) => {
                const toAdd = {};
                toAdd[keys[i]] = cur;
                return { ...acc, ...toAdd };
            }, {});
        });
    };

    orderData = (dateCount) => {
        let self = this;
        return _.orderBy(_.filter(self.state.data, function(o) { return (o.date == self.state.dates[dateCount] && o[self.state.selectedBaseMetric] != null && o[self.state.selectedBaseMetric] != 'NaN') }),[self.state.selectedBaseMetric],['desc']);
    }

    orderMapData = (dateCount) => {
        let self = this;
        return _.orderBy(_.filter(self.state.data, function(o) { return (o.date == self.state.dates[dateCount]) }),[self.state.selectedBaseMetric],['desc']);
    }

    

    onUpdate = (render, handle, value, un, percent) => {
        let self = this;

        this.setState({
          currentDate: this.state.dates[parseInt(value[0]-1)],
          currentDateCount: parseInt(value[0]-1),
          selectedDateData: this.orderData(parseInt(value[0]-1)),
          selectedDateDataMap: this.orderMapData(parseInt(value[0]-1)),
          update: self.state.update + 1
        });

    }

    dateSelect = (e) => {
        let self = this;

        let date = moment(e._d).format("YYYY-MM-DD").toString() + 'T00:00:00';

        let dateCount = _.findIndex(self.state.dates, function(o) { return o == date; });

        if(dateCount > -1) {
            self.setState({
                currentDate: date,
                currentDateCount: dateCount,
                selectedDateData: this.orderData(dateCount),
                selectedDateDataMap: this.orderMapData(dateCount),
                update: self.state.update + 1
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
                selectedDateData: this.orderData(self.state.currentDateCount),
                selectedDateDataMap: this.orderMapData(self.state.currentDateCount),
                update: self.state.update + 1
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
            selectedDateData: this.orderData(direction == 'forward' ? self.state.currentDateCount + 1 : self.state.currentDateCount - 1),
            selectedDateDataMap: this.orderMapData(direction == 'forward' ? self.state.currentDateCount + 1 : self.state.currentDateCount - 1),
            update: self.state.update + 1
        }, () => {
            self.state.ref.noUiSlider.set(self.state.currentDateCount + 1);
        });
        
    }

    jumpToLatest = () => {
        let self = this;
        this.setState({
            currentDate: self.state.dates[self.state.dates.length-1],
            currentDateCount: self.state.dates.length,
            selectedDateData: this.orderData(self.state.dates.length-1),
            selectedDateDataMap: this.orderMapData(self.state.dates.length-1),
            update: self.state.update + 1
        });

        self.state.ref.noUiSlider.set(self.state.dates.length);
    }

    countrySelect = (country) => {
        let self = this;
        if(_.find(self.state.selectedCountries, function(o) { return o.iso_code == country.iso_code }) == undefined) {
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

    selectBaseMetric = () => {
        let self = this;
        self.setState({
            currentDate: self.state.currentDate,
            currentDateCount: self.state.currentDateCount,
            selectedBaseMetric: this.state.selectedBaseMetric == 'new_cases_smoothed_per_million' ? 'new_cases_smoothed' : 'new_cases_smoothed_per_million'
        }, () => {
            self.setState({
                selectedDateData: self.orderData(self.state.currentDateCount), // This must execute after setState above so that self.state.selectedBaseMetric is updated.
                selectedDateDataMap: self.orderMapData(self.state.currentDateCount),
                update: self.state.update + 1
            })
        });




    }

    render() {
        return (
            !this.state.loggedIn ?
            <>
                <div className="position-absolute top-50 start-50 translate-middle text-center">
                    <h3 className="mt-4">Login</h3>
                    <Form.Control type="password" onChange={(e) => e.target.value == process.env.ACDC_PASS ? this.setState({loggedIn: true}) : '' }></Form.Control>
                </div>
            </> :
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

                    { document.URL.indexOf('?embed') == -1 ? <Header /> : '' }

                    { (window.innerWidth > 800) || (this.state.selectedCountries.length == 0 && window.innerWidth < 800) ? 
                       
                            <Container style={this.state.no_embed_style} className="justify-content-between">

                                { document.URL.indexOf('?embed') == -1 &&
                                    <Row>
                                        <Col>
                                            <h1>COVID-19 Observer</h1>
                                        </Col>
                                    </Row>
                                }



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
                                                    

                                                    <Col></Col>
                                                
                                                
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
                                                            <Accordion.Item eventKey="0">
                                                                <Accordion.Header>{_.filter(texts[this.state.api.dataset], function(def) { return def.name == 'introductory_paragraph'})[0].title}</Accordion.Header>
                                                                <Accordion.Body>
                                                                    <p className="text-black-50 mt-3">{_.filter(texts[this.state.api.dataset], function(def) { return def.name == 'introductory_paragraph'})[0].text}</p>
                                                                </Accordion.Body>
                                                            </Accordion.Item>
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
                                    
                                        this.state.tab == 'map' && this.state.selectedCountries.length == 0 ?
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
                        { this.state.selectedCountries.length > 0 ?
                            <Row>
                                <Col>
                                    <CountryData
                                        selectedCountry={this.state.selectedCountries}
                                        onDeselectCountry={this.onDeselectCountry}
                                        api={this.state.api}
                                        selectedBaseMetric={this.state.selectedBaseMetric}
                                        selectBaseMetric={this.selectBaseMetric}
                                    /> 
                                </Col>
                            </Row>
                        :
                            <Row>
                                <Col lg={6} className="mb-4">
                                        <CaseMap
                                            onCountrySelect={this.countrySelect}
                                            data={this.state.selectedDateDataMap}
                                            api={this.state.api}
                                            selectedBaseMetric={this.state.selectedBaseMetric}
                                            selectBaseMetric={this.selectBaseMetric}
                                            update={this.state.update}
                                        />
                                </Col>
                                <Col>
                                    <Leaderboard 
                                        data={this.state.selectedDateData}
                                        onCountrySelect={this.countrySelect}
                                        playingTimeline={this.state.playingTimeline}
                                        api={this.state.api}
                                        selectedBaseMetric={this.state.selectedBaseMetric}
                                    />
                                </Col>
                            </Row>
                        }
                    </Container>
                :
                    <Container className="my-4" fluid>
                        <Row>
                            <Col>
                                <CovidDataTable 
                                    currentDate={this.state.currentDate}
                                    api={this.state.api}
                                />
                            </Col>
                        </Row>
                    </Container>
                }
            </>)
        
    }

}


const container = document.getElementsByClassName('app')[0];

ReactDOM.render(React.createElement(App), container);