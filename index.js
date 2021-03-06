//import { select,range,json} from 'd3';
import {
    select
  } from 'd3';

import { renderDiagram } from './renderHubSpoke';
import { renderGraph, initializeGraph, prepData } from './renderLineGraph';
import {generateData} from './generateMockDataEzone';

//import {getLatest, prepData, groupData, mergeMaps} from './getLatestData';



/**
 * Render the energy network view and the line graph view as needed
 */

const display = () => {
  if(displayingGraph){
    let dataFiltered;
    //Remove unwanted devices from data and get y limits of data
    [dataFiltered, chartProps.y] = prepData(dataView)
    //get x limits
    chartProps.x = [new Date(time-view),new Date(time)]
    //render line chart
    renderGraph(dataFiltered,chartProps, svg, period)
  }else{
    //render energy network
    renderDiagram(getLatest(dataView,time), time);
  }
}




/**
 * Initial load of data
 */
const refreshData = ()=>{
  dataView = generateData().exportData();
  display()
}

/**
 * Switch between displaying energy network and line graph
 */
window.toggleDisplay = ()=>{
  //reset DOM
  divNav.selectAll('select').remove()
  svg.selectAll("*").remove();
  //toggle display mode
  displayingGraph = !displayingGraph
  //initialize Line Chart
  if(displayingGraph){
    //set up select DOM element for changing timeframe
    renderUIChart(Array.from(chartOptions.keys()))
    svg.append('g').attr("class","chartLayer")
    initializeGraph(svg.select(".chartLayer"))
  }else{
  //initialize energy network
    svg.append('g').attr("class","edgeLayer");
    svg.append('g').attr("class","nodeLayer");
    svg.append('g').attr("class","textLayer");
  }
  display()
}
 
/**
 * Add Line Graph UI options
 * @param {*} data - array of strings to populate select form 
 */
const renderUIChart = (data) =>{
  //initialize select form
  const dropdownButton = divNav.append('select')
    .attr("name", "timeframe")
    .attr("class", "form-select")
  //populate select form
  dropdownButton.selectAll('myOptions').data(data).enter().append('option')
    .merge(dropdownButton)
    .text((d) => { return d; }) // text showed in the menu
    .attr("value", d => { return d; }) // corresponding value returned by the button
  //add interavtivity to form options
  dropdownButton.on("change", (d) => {
    period = dropdownButton.property("value")
    view = chartOptions.get(period)
    display()
  })
}
/**
 * convert days and hours into milliseconds
 * @param {*} days - number of days
 * @param {*} hours - number of hours
 * @returns sum number of milliseconds 
 */
const getMS = (days, hours) => {
  return (days*24+hours)*60*60*1000
}

/**
 * switch to animated recent data mode for energy network
 * @param {*} period  - The number of milliseconds to display total. The first timestamp is end time minus period.
 * @param {*} frequency - The gap in milliseconds between animation keyframes
 * @param {*} end - The Date object representing the last timestamp keyframe
 * @param {*} animationSpeed - period delay between keyframes in milliseconds
 */
window.replayPeriod = (period = getMS(1,0), frequency = getMS(0,1/12), end = Date.parse("2021-07-21 09:00:00"), animationSpeed = 800) => {
  //ensure diagram is displaying
  if(displayingGraph) toggleDisplay();
  //set global time to start time of animation
  time = end - period
  //Update data and display for each keyframe
  let timer = window.setInterval(() =>{
    if(time<end){
      time += frequency
    }else{
      clearInterval(timer);
      time = timeEnd
    } 
    display()
  },animationSpeed)
}

/**
 * Return latest entries of data, simulate Battery and Grid data
 * @param {*} data Map of data. See DataStore for details
 * @param {*} time Date object, if a time other than current time is required
 * @returns Map of latest power value for each device
 */

const getLatest = (data, time = new Date) =>{
  const round = (x, n) => {
    return Math.round(x * 10 ** n) / 10 ** n;
  }
  //Simulate battery power IO given network behaviour and time
  const mockBattery = (e, t) => {
      const batteryMax = 5
      if (e > 0) {//generation more than consumption
          return -1*Math.min(e, batteryMax)
      } else {//consumption greater than generation
          const peakLow = 9;
          const peakHigh = 5;
          const isPeak = t.getHours() > peakLow && t.getHours() < peakHigh;
          return (isPeak ? Math.min(e, batteryMax) : 0)
      }
  }
  let consumers = ["DC Charger", "Consumption"]
  let producers = ["Solar Panels","Wind Turbine"]
  let total = 0;
  let dataMap = new Map();
  let timeStart = time - (new Date(time).getMinutes()%5)*1000*60
  let timeKey,nodeCurrent;
  //for each node
  for(let key of data.keys()){
    nodeCurrent = data.get(key).datapoints
    timeKey = timeStart
    //Uncomment to search for a recent record if current data not availible
    //while(!nodeCurrent.has(new Date(timeKey))&&timeKey>1000*60*60){timeKey -= 5*60*1000;}
    let powerLatest
    if(nodeCurrent.has(timeKey)){
      powerLatest = nodeCurrent.get(timeKey)
    }else{
      powerLatest = 0;
    }
    //if(isNaN(powerLatest)) powerLatest = 0;
    if(consumers.includes(key)){//consumer
      total -= powerLatest
      dataMap.set(key,round(-1*powerLatest,2));
    }else if(producers.includes(key)){//producer
      total += powerLatest
      dataMap.set(key,round(powerLatest,2));
    }
  }
  const powerBattery = mockBattery(total,new Date())
  const powerGrid = total + powerBattery
  dataMap.set("Battery",round(-1*powerBattery,2))
  dataMap.set("Grid",round(-1*powerGrid,2))
  return dataMap
}


//Initialize svg canvas for energy network
const svg = select('#diagram');
const width = +svg.attr('width');
const height = +svg.attr('height');
  
svg.append('g').attr("class","edgeLayer");
svg.append('g').attr("class","nodeLayer");
svg.append('g').attr("class","textLayer");

// line chart timescale options
var chartOptions = new Map()
chartOptions.set("day",getMS(1,0))
chartOptions.set("week",getMS(7,0))
chartOptions.set("fortnight",getMS(14,0))
var period = "day"
var view  = chartOptions.get(period)

const divNav = select(".navbar-nav")
let displayingGraph = false;
const timeEnd = Date.parse("2021-07-21 09:00:00")
let time = timeEnd
var dataView = {}
let chartProps = {"x":0,"y":0}

//Initial data load and render
refreshData()
