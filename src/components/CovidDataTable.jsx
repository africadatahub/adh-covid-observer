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

import { Sparklines, SparklinesLine } from 'react-sparklines';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { faFileDownload,faTimes, faArrowDown } from '@fortawesome/free-solid-svg-icons';

import Spinner from 'react-bootstrap/Spinner';

import * as countriesList from '../data/countries.json';

import { owid_fields } from '../data/owid_fields.js';


export class CovidDataTable extends React.Component {
    constructor() {
        super();
        this.state = {
            data: [],
            visible_data: [],
            columns: [],
            columns_select: [],
            columns_selected: [],
            countries_select: [],
            countries_selected: [],
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
                        '&:not(:last-of-type)': {
                            borderRightStyle: 'solid',
                            borderRightWidth: '1px',
                            borderRightColor: defaultThemes.default.divider.default,
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
        let self = this;

        let columns = [];
        let columns_select = [];
        let countries_select = [];


        
        console.log(this.props.currentDate);




        for (let i = 0; i < owid_fields.length; i++) {

            let cell = row => row[owid_fields[i]];
            let cellStyles = [];

            if(owid_fields[i] == 'location') {
                
                cell = row => 
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
                        <div className="text-truncate">{ row.location }</div>
                    </>
            }

            if(owid_fields[i] == 'case_history') {
                cell = row =>
                    row.case_history != undefined ? 
                    <Sparklines data={row.case_history.replaceAll('nan','0.0').split('|')}>
                        <SparklinesLine style={{ strokeWidth: 2, stroke: "#094151", fill: "#B3D2DB", fillOpacity: "1" }}/>
                    </Sparklines>
                    : '';
                cellStyles = {
                    padding: 0,
                    // maxWidth: '150px'
                }
                
            }
            
            columns.push(
                {
                    name: <span className="text-uppercase text-truncate">{owid_fields[i].replaceAll('_', ' ')}</span>,
                    selector: row => row[owid_fields[i]],
                    cell: cell,
                    sortable: owid_fields[i] == 'case_history' ? false : true,
                    field: owid_fields[i],
                    width: owid_fields[i] == 'location' ? '200px' : owid_fields[i] == 'case_history' ? '150px' : '',
                    style: cellStyles,
                }
            )

            columns_select.push(
                {
                    value: owid_fields[i],
                    label: owid_fields[i]
                }
            )

            
        }

        for (let i = 0; i < countriesList.length; i++) {
            countries_select.push(
                {
                    value: countriesList[i].iso_code,
                    label: countriesList[i].location
                }
            )
        }

        self.setState(
            {
                columns: columns, 
                visible_columns: columns,
                columns_select: columns_select,
                columns_selected: columns_select,
                countries_select: countries_select,
                countries_selected: countries_select
            }
        );

        self.get_data_debounce();
       
    }

    componentDidUpdate(prevProps, prevState) {
        let self = this;
        
        if(prevProps.currentDate != self.props.currentDate) {
            self.get_data_debounce();
        }
        
    }

    debounce(func, timeout = 1000){
        let timer;
        return (...args) => {
          clearTimeout(timer);
          timer = setTimeout(() => { func.apply(this, args); }, timeout);
        };
    }

    get_data_debounce = this.debounce(() => this.get_data());

    get_data() {
        let self = this;

        self.setState({loading:true})

        axios.get('https://adhtest.opencitieslab.org/api/3/action/datastore_search_sql?sql=SELECT%20*%20from%20"' + this.props.api.countryData + '"%20where%20date%20%3D%20%27' + this.props.currentDate + '%27',
            { 
                headers: {
                authorization: process.env.REACT_API_KEY
                }
            }
        ).then(function(response) {

            let incoming_data = response.data.result.records;

            for(let i=0; i < incoming_data.length; i++) {
                for (const key in incoming_data[i]) {
                    if (incoming_data[i].hasOwnProperty(key)) {
                        if (key != 'location' && key != 'iso_code') {
                            if(key != 'stringency_index') {
                                incoming_data[i][key] = incoming_data[i][key] == 'NaN' ? '-' : parseInt(incoming_data[i][key]);
                            } else {
                                incoming_data[i][key] = incoming_data[i][key] == 'NaN' ? '-' : parseFloat(incoming_data[i][key]);
                            }
                            
                            if(incoming_data[i][key] == NaN) {
                                incoming_data[i][key] = ''
                            }

                        }
                    }
                }

                _.merge(incoming_data[i], _.find(self.props.resurgenceData, function(o) { return o.iso_code == incoming_data[i].iso_code; }))

            }

            let countries = [];

            for (let i = 0; i < self.state.countries_selected.length; i++) {
                countries.push(self.state.countries_selected[i].value);
            }

            let visible_data = _.filter(incoming_data, function(o) { return _.find(countries, function(c) { return c == o.iso_code; }) != undefined });

            self.setState({visible_data: visible_data});


            self.setState(
                {
                    data: incoming_data,
                    visible_data: visible_data
                }
            );

            self.setState({loading:false})

        })



    }

    select_countries = (e) => {
        let self = this;

        self.setState({countries_selected: e});

        let countries = [];

        for (let i = 0; i < e.length; i++) {
            countries.push(e[i].value);
        }

        let visible_data = _.filter(this.state.data, function(o) { return _.find(countries, function(c) { return c == o.iso_code; }) != undefined });

        self.setState({visible_data: visible_data});

    }

    select_columns = (e) => {
        let self = this;
        self.setState({columns_selected: e})

        let columns = [];

        for (let i = 0; i < e.length; i++) {
            columns.push(e[i].value);
        }

        let visible_columns = _.filter(this.state.columns, function(o) { return _.find(columns, function(c) { return c == o.field }) != undefined });

        self.setState({visible_columns: visible_columns});

    }

    

    customSort = (rows, selector, direction) => {
        return _.orderBy(rows, selector, direction);
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
    
    
    downloadCSV(array) {

        const link = document.createElement('a');
        let csv = this.convertArrayOfObjectsToCSV(array);
        if (csv == null) return;
    
        const filename = 'export.csv';
    
        if (!csv.match(/^data:text\/csv/i)) {
            csv = `data:text/csv;charset=utf-8,${csv}`;
        }
    
        link.setAttribute('href', encodeURI(csv));
        link.setAttribute('download', filename);
        link.click();
    }

    

   

    render() {
        let self = this;
        return (
            
            <Card className="mt-5">
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
                            
                            <MultiSelect
                                options={this.state.columns_select}
                                value={this.state.columns_selected}
                                onChange={this.select_columns}
                                overrideStrings={
                                    {
                                        "allItemsAreSelected": "All METRICS are selected.",
                                        "clearSearch": "Clear Search",
                                        "noOptions": "No options",
                                        "search": "Search",
                                        "selectAll": "Select All",
                                        "selectAllFiltered": "Select All (Filtered)",
                                        "selectSomeItems": "Select Metrics"
                                    }
                                }
                            />
                        </Col>
                        <Col>
                                
                        </Col>
                        <Col xs="auto" className="align-self-center">
                            <span className="text-black-50">Source: <a className="text-black-50" target="_blank" href="https://www.ourworldindata.com">www.ourworldindata.com</a></span>
                        </Col>
                        <Col xs="auto" className="align-self-center">
                            <Button onClick={e => this.downloadCSV(this.state.visible_data)} variant="light-grey" style={{color: "#094151"}}><FontAwesomeIcon icon={faFileDownload} />&nbsp;Download Table Data</Button>
                        </Col>
                    </Row>

                    
                    <DataTable 
                    columns={this.state.visible_columns}
                    data={this.state.visible_data}
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
            
        );
    }
}