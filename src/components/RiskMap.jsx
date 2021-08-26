import React from 'react';
import _ from 'lodash';

import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Card from 'react-bootstrap/Card';
import Button from 'react-bootstrap/Button';
import Badge from 'react-bootstrap/Badge'

import { MapContainer, TileLayer, GeoJSON, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

import { countriesData } from '../data/geojson/africa.js';

export class RiskMap extends React.Component {
    constructor() {
        super();
        this.state = {
            map: undefined,
            scale: [
                {
                    low: -100,
                    high: -51,
                    color: '#2E9FF1'
                },
                {
                    low: -50,
                    high: -26,
                    color: '#70C3FF'
                },
                {
                    low: -25,
                    high: -11,
                    color: '#9DD6FF'
                },
                {
                    low: -10,
                    high: 0,
                    color: '#E0F2FF'
                },
                {
                    low: 0,
                    high: 10,
                    color: '#FFECEC'
                },
                {
                    low: 11,
                    high: 25,
                    color: '#FFD1D1'
                },
                {
                    low: 26,
                    high: 50,
                    color: '#FFB7B7'
                },
                {
                    low: 50,
                    high: 100,
                    color: '#FF8585'
                },
                {
                    low: 101,
                    high: 500,
                    color: '#FF5454'
                },
            ]
        }
    }

    componentDidMount() {
       

    }

    componentDidUpdate() {
    }

    getColor = (amount) => {
        let self = this;
        let selectedColor = '';

        _.forEach(self.state.scale, function(color) {
            if(Math.round(amount) <= color.high && Math.round(amount) >= color.low) {
                selectedColor = color.color;
            }
            
        })

        return selectedColor;

    }

    style = (feature) => {

        let self = this;
        let color = 0;

        if(self.props.data != undefined && self.props.data.length > 0) {
            let country = _.filter(self.props.data, function(o) { return o.iso_code == feature.properties.adm0_a3; })[0];
            if(country != undefined) {
                color = country.change;
            }
        }

        return {
            fillColor: self.getColor(color),
            weight: 0.5,
            opacity: 1,
            color: '#fff',
            dashArray: '0',
            fillOpacity: 1
        };
        
    }

    countryAction = (feature, layer) => {

        let self = this;

        layer.on('click', function (e) {
            self.props.onCountrySelect(
                { 
                    iso_code: e.target.feature.properties.adm0_a3,
                    location: e.target.feature.properties.name
                }
            );

        });

        layer.on('mouseover', function (e) {
            this.setStyle({
                'color': '#000'
            });
        });
        layer.on('mouseout', function () {
            this.setStyle({
              'color': '#fff'
            });
        });


    }

    render() {
        return (
            <>
                <Card className="border-0 rounded">
                    <Card.Body>
                        <h5>% Change in new cases per million (7 day average)</h5>
                        <hr/>
                        <MapContainer 
                            center={[-0, 20]}
                            zoom={2.5}
                            scrollWheelZoom={false}
                            zoomControl={false}
                            attributionControl={false}
                            style={{background: '#fff'}}
                            >
                            {/* <TileLayer
                                attribution='Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ'
                                url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
                            /> */}
                            {this.props.data[0] != undefined ?
                                <GeoJSON
                                key={this.props.data[0].date}
                                onEachFeature={this.countryAction}
                                data={countriesData}
                                style={this.style}>
                                    
                                </GeoJSON>
                            : '' }
                            <div className="position-absolute fw-bold" style={{bottom: 0}}>
                                <div>
                                    <Badge style={{background: '#FF5454',top: '-2px'}} className="chart-scale position-relative">&nbsp;</Badge> &gt; 100% increase
                                </div>
                                <div className="my-1">
                                    <Badge style={{background: '#FF8585',top: '-2px'}} className="chart-scale position-relative">&nbsp;</Badge> 50%
                                </div>
                                <div className="my-1">
                                    <Badge style={{background: '#FFB7B7',top: '-2px'}} className="chart-scale position-relative">&nbsp;</Badge> 25%
                                </div>
                                <div className="my-1">
                                    <Badge style={{background: '#FFD1D1',top: '-2px'}} className="chart-scale position-relative">&nbsp;</Badge> 10%
                                </div>
                                <div className="my-1">
                                    <Badge style={{background: '#FFECEC',top: '-2px'}} className="chart-scale position-relative">&nbsp;</Badge> 0%
                                </div>
                                <div className="my-1">
                                    <Badge style={{background: '#E0F2FF',top: '-2px'}} className="chart-scale position-relative">&nbsp;</Badge> 15%
                                </div>
                                <div className="my-1">
                                    <Badge style={{background: '#9DD6FF',top: '-2px'}} className="chart-scale position-relative">&nbsp;</Badge> 25%
                                </div>
                                <div className="my-1">
                                    <Badge style={{background: '#70C3FF',top: '-2px'}} className="chart-scale position-relative">&nbsp;</Badge> 50%
                                </div>
                                <div className="my-1">
                                    <Badge style={{background: '#2E9FF1',top: '-2px'}} className="chart-scale position-relative">&nbsp;</Badge> &lt; 100% decrease
                                </div>
                            </div>
                        </MapContainer>
                        <hr/>
                        <Row className="align-items-center">
                            <Col><span className="text-black-50">Source: <a className="text-black-50" target="_blank" href="https://www.ourworldindata.com">www.ourworldindata.com</a></span></Col>
                            {/* <Col xs="auto">
                                <Button variant="control-grey">Embed</Button>&nbsp;&nbsp;
                                <Button variant="control-grey">Download Data</Button>
                            </Col> */}
                        </Row>
                        <hr/>
                        <h6>How we calculate resurgance:</h6>
                        <p className="text-black-50 mt-4">Using data from Our World In Data, the resurgence map uses a 7-day rolling window to measure the percentage change in the number of new confirmed cases in that period relative to the previous 7 days over the course of the pandemic.
                        </p>
                    </Card.Body>
                </Card>
            </>
        );
    }
}