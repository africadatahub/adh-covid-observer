import React from 'react';
import axios from 'axios';
import _ from 'lodash';

import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Card from 'react-bootstrap/Card';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';

import getCountryISO2 from 'country-iso-3-to-2';
import ReactCountryFlag from 'react-country-flag';

import DataTable, { defaultThemes } from 'react-data-table-component';

import { MultiSelect } from "react-multi-select-component";

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { faFileDownload,faTimes, faArrowDown } from '@fortawesome/free-solid-svg-icons';

import 'react-dates/initialize';
import { DateRangePicker } from 'react-dates';
import 'react-dates/lib/css/_datepicker.css';

import Spinner from 'react-bootstrap/Spinner';

import * as countriesList from '../data/countries.json';

import { owid_fields } from '../data/owid_fields.js';

import moment from 'moment';


export class CovidDataTable extends React.Component {
    constructor() {
        super();
        this.state = {
            data: [],
            metrics: [],
            metric_selected: '',
            countries_select: [],
            countries_selected: [],
            startDate: null,
            endDate: null,
            focusedInput: null,
            customStyles: {
                table: {
                    style: {
                        maxHeight: 'calc(100vh - 300px)'
                    },
                },
                header: {
                    style: {
                        minHeight: '56px',
                    },
                },
                headRow: {
                    style: {
                        borderTopStyle: 'solid',
                        borderTopWidth: '1px',
                        borderTopColor: defaultThemes.default.divider.default,
                    },
                },
                headCells: {
                    style: {
                        background: '#eee',
                        fontWeight: 'bold',
                        '&:not(:last-of-type)': {
                            borderRightStyle: 'solid',
                            borderRightWidth: '1px',
                            borderRightColor: defaultThemes.default.divider.default,
                            background: '#eee',
                            fontWeight: 'bold',
                        },
                    }
                },
                cells: {
                    style: {
                        '&:not(:last-of-type)': {
                            borderRightStyle: 'solid',
                            borderRightWidth: '1px',
                            borderRightColor: defaultThemes.default.divider.default,
                            
                        },
                    },
                }
            },
            loading: true

        }
    }

    componentDidMount() {

        let metrics = [];

        let countries_select = [];
        
        for (let i = 0; i < countriesList.length; i++) {
            countries_select.push(
                {
                    value: countriesList[i].iso_code,
                    label: countriesList[i].location
                }
            )
        }

        let query = 'SELECT%20max%28date%29%20FROM%20"' + this.props.api.countryData + '"';



        axios.get('https://adhtest.opencitieslab.org/api/3/action/datastore_search_sql?sql=' + query,
            { headers: {
                authorization: process.env.REACT_API_KEY
            }
        }).then((response) => {

            this.setState(
                {
                    countries_select: countries_select,
                    countries_selected: countries_select,
                    metric_selected: 'total_cases',
                    startDate: moment(response.data.result.records[0].max).add(-1,'months'),
                    endDate: moment(response.data.result.records[0].max)
    
                }
            );
            

        })

        


        

        

        setTimeout(() => {
            this.getData();
        }, 1000);


        

    }

    componentDidUpdate() {

    }

    select_countries = (e) => {

        this.setState({countries_selected: e, loading: true});
        
        setTimeout(() => {
            this.getData();
        }, 1000);



    }

    select_metric = (e) => {

        this.setState({metric_selected: e.target.value, loading: true });
        
        setTimeout(() => {
            this.getData();
        }, 1000);
    }

    select_dates = ({ startDate, endDate }) => {

        this.setState({ startDate, endDate, loading: true });


        setTimeout(() => {
            this.getData();
        }, 1000);
    
    }

    convertArrayOfObjectsToCSV(array) {
        let result;
    
        const columnDelimiter = ',';
        const lineDelimiter = '\n';
        const keys = Object.keys(array[0]);
    
        result = '';
        result += keys.join(columnDelimiter);
        result += lineDelimiter;
    
        array.forEach(item => {
            let ctr = 0;
            keys.forEach(key => {
                if (ctr > 0) result += columnDelimiter;
    
                result += item[key];
                
                ctr++;
            });
            result += lineDelimiter;
        });
    
        return result;
    }

    downloadCSV = () => {
        const link = document.createElement('a');
        let csv = this.convertArrayOfObjectsToCSV(this.state.data);
        if (csv == null) return;
    
        const filename = 'export-' + this.state.metric_selected + '-' + moment(this.state.startDate).format('DDMMYY') + '-' + moment(this.state.endDate).format('DDMMYY') + '.csv';
    
        if (!csv.match(/^data:text\/csv/i)) {
            csv = `data:text/csv;charset=utf-8,${csv}`;
        }
    
        link.setAttribute('href', encodeURI(csv));
        link.setAttribute('download', filename);
        link.click();
    }

    getData() {

        let self = this;

        let countries_selected_query = '';

        let countries_selected = this.state.countries_selected;

        for (let index = 0; index < countries_selected.length; index++) {
            countries_selected_query += '%27' + countries_selected[index].value + '%27';
            if(index < (countries_selected.length - 1)) {
                countries_selected_query += '%2C';
            }
        }

        let query = 'SELECT%20date%2Ciso_code%2Clocation%2C' + this.state.metric_selected + '%20FROM%20"' + this.props.api.countryData + '"%20WHERE%20date%20BETWEEN%20%27' + moment(this.state.startDate).format('YYYY-MM-DD') + '%27%20AND%20%27' + moment(this.state.endDate).format('YYYY-MM-DD') + '%27%20AND%20iso_code%20IN%28' + countries_selected_query + '%29';
        
        

        if(this.state.countries_selected.length > 0) {

            axios.get('https://adhtest.opencitieslab.org/api/3/action/datastore_search_sql?sql=' + query,
                { headers: {
                    authorization: process.env.REACT_API_KEY
                }
            }).then(function(response) {

                let data = []

                let columns = [
                    {
                        name: 'COUNTRY',
                        selector: row => row.iso_code,
                        cell: row => 
                        <>
                            <div style={{width: '2em', height: '2em', borderRadius: '50%', overflow: 'hidden', position: 'relative'}} className="border">
                                <ReactCountryFlag
                                svg
                                countryCode={getCountryISO2(row.iso_code)}
                                style={{
                                    position: 'absolute', 
                                    top: '30%',
                                    left: '30%',
                                    marginTop: '-50%',
                                    marginLeft: '-50%',
                                    fontSize: '2.8em',
                                    lineHeight: '2.8em',
                                }}/>
                            </div>
                            <div className="text-truncate ms-1">{ row.location }</div>
                        </>,
                        width: '200px'

                    }
                ];



                let grouped_data = _.groupBy(response.data.result.records,'iso_code');

                let first_country = Object.keys(grouped_data)[0];

                for (let index = 0; index < grouped_data[first_country].length; index++) {

                    columns.push(
                        {
                            name: moment(grouped_data[first_country][index].date).format('DD/MM/YY'),
                            selector: row => row[grouped_data[first_country][index].date]
                        }
                    )
                    
                }



                for (const key in grouped_data) {
                    let country_data = {
                        iso_code: key,
                        location: grouped_data[key][0].location
                    }
                    for (let index = 0; index < grouped_data[key].length; index++) {
                        country_data[grouped_data[key][index].date] = grouped_data[key][index][self.state.metric_selected];

                    }

                    data.push(country_data);

                }

                self.setState({
                    columns: columns, 
                    data: data,
                    loading: false
                });

             
            })
        
        }
    }

    render() {

        return (
            <Card>
                <Card.Body>

                    <Row className="mb-4">
                        <Col xs="3">
                            <MultiSelect
                                options={this.state.countries_select}
                                value={this.state.countries_selected}
                                onChange={this.select_countries}
                                overrideStrings={
                                    {
                                        "allItemsAreSelected": "All COUNTRIES are selected.",
                                        "clearSearch": "Clear Search",
                                        "noOptions": "No options",
                                        "search": "Search",
                                        "selectAll": "Select All",
                                        "selectAllFiltered": "Select All (Filtered)",
                                        "selectSomeItems": "Select Countries"
                                    }
                                }
                            />
                        </Col>
                        <Col xs="3">
                            <Form.Select aria-label="Default select example" onChange={this.select_metric}>
                                { owid_fields.map( (metric) => {
                                    if(metric != 'location' && metric != 'case_history') {
                                        return <option key={ metric } value={ metric }>{ metric.replaceAll('_', ' ') }</option>
                                    }
                                })}
                            </Form.Select>
                        </Col>
                        <Col>
                        <DateRangePicker
                            startDate={this.state.startDate} 
                            startDateId="startDate" 
                            endDate={this.state.endDate} 
                            endDateId="endDate" 
                            onDatesChange={this.select_dates} 
                            focusedInput={this.state.focusedInput} 
                            onFocusChange={focusedInput => this.setState({ focusedInput })} 
                            startDatePlaceholderText='START'
                            endDatePlaceholderText='END'
                            small={true}
                            isOutsideRange={() => false}
                        />                                
                        </Col>
                        <Col xs="auto" className="align-self-center">
                            <span className="text-black-50">Source: <a className="text-black-50" target="_blank" href="https://www.ourworldindata.com">www.ourworldindata.com</a></span>
                        </Col>
                        <Col xs="auto" className="align-self-center">
                            <Button onClick={this.downloadCSV} variant="light-grey" style={{color: "#094151"}}><FontAwesomeIcon icon={faFileDownload} />&nbsp;Download Table Data</Button>
                        </Col>
                    </Row>

                    {/* https://react-data-table-component.netlify.app/ */}

                    <DataTable 
                        columns={this.state.columns}
                        data={this.state.data}
                        dense={true}
                        striped={true}
                        fixedHeader={true}
                        conditionalRowStyles={this.state.conditionalRowStyles}
                        customStyles={this.state.customStyles}
                        sortFunction={this.customSort}
                        progressPending={this.state.loading}
                        progressComponent={
                            <div className="text-center">
                                <Spinner animation="grow" />
                                <h3 className="mt-4">Loading</h3>
                            </div>
                        }
                        highlightOnHover={false}
                    />
                </Card.Body>
            </Card>
        )


    }


}