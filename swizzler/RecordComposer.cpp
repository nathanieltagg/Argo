//
// Code for the Arachne Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//


#include <iostream>
#include <fstream>
#include <sstream>
#include <vector>
#include <algorithm>
#include <time.h>
#include <math.h>
#include <stdio.h>

#include "TH1F.h"

#include "RecordComposer.h"
#include "JsonElement.h"
#include "ColorMap.h"
#include "MakePng.h"
#include <stdlib.h>

#include "eventRecord.h"
#include "crateHeader.h"
#include "crateData.h"
#include "channelData.h"


using namespace std;
using namespace gov::fnal::uboone::datatypes;


std::string RecordComposer::sfFileStoragePath = "../datacache";
std::string RecordComposer::sfUrlToFileStorage = "datacache";

void BuildThumbnail(const std::string& pathname, const std::string& thumbname)
{
  // Compose a thumbnail image using external application. 
  // Fork a background process for more speed.
  std::string cmd = "PATH=$PATH:/usr/local/bin convert ";
  cmd += pathname;
  cmd += " -sample 20% ";
  cmd += thumbname;
  cmd += " &";
  std::cerr << "BuildThumbnail: " << cmd << std::endl;
  system(cmd.c_str());
}


JsonObject TH1ToHistogram( TH1* hist )
{
  JsonObject h;
  if(!hist) return h;
  h.add("n",hist->GetNbinsX());
  h.add("min",hist->GetXaxis()->GetXmin());
  h.add("max",hist->GetXaxis()->GetXmax());
  h.add("underflow",hist->GetBinContent(0));
  h.add("overflow",hist->GetBinContent(hist->GetNbinsX()+1));
  double tot = hist->GetSumOfWeights();
  h.add("total",tot);
  h.add("sum_x",tot*hist->GetMean());
  h.add("max_content",hist->GetMaximum());
  h.add("min_content",hist->GetMinimum());
  JsonArray data;
  for(int i=1; i <= hist->GetNbinsX();i++) {
    data.add(hist->GetBinContent(i));
  }
  h.add("data",data);
  return h;
}


inline unsigned char tanscale(float adc) 
{
  return (unsigned char)(atan(adc/50.)/M_PI*256.) + 127;  
}

inline float inv_tanscale(unsigned char y) 
{
  return tan((y-127)*M_PI/256.)*50.;
}
 




RecordComposer::  RecordComposer(JsonObject& output, gov::fnal::uboone::datatypes::eventRecord& event, const std::string options)
  : fOutput(output), fEvt(event), fOptions(options)
    ,fPalette(256*3) 
   ,fPaletteTrans(256) 
{
  unsigned char vv[] =   { 
    #include "palette.inc" 
  };
  fPalette.assign(&vv[0], &vv[0]+sizeof(vv));
  unsigned char vvt[] =   { 
    #include "palette_trans.inc" 
  };
  fPaletteTrans.assign(&vvt[0], &vvt[0]+sizeof(vvt));
};
  
RecordComposer::~RecordComposer()
{
}

static void hsvToRgb(unsigned char* out, float h, float s, float v){
    float r, g, b;

    int i = floor(h * 6);
    float f = h * 6 - i;
    float p = v * (1 - s);            // 0
    float q = v * (1 - f * s);        // 1-f
    float t = v * (1 - (1 - f) * s);  // f

    switch(i % 6){
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }
    
    // cout << (int)(r*255) << "\t"
    //     << (int)(g*255) << "\t"
    //     << (int)(b*255) << "\n";
    // return rgbToHsv(int(r*255),int(g*255),int(b*255));
    // return [r * 255, g * 255, b * 255];
    *(out   ) = (unsigned int)(r*255);
    *(out+1 ) = (unsigned int)(g*255);
    *(out+2 ) = (unsigned int)(b*255);
}


void RecordComposer::composeHeaderData() 
{
  // Header data. Alas, this is the stuff that's nearly impossible to get!  
  JsonObject header;
  header.add("run"   ,fEvt.getGlobalHeaderPtr()->getRunNumber());
  // header.add("subrun",ftr.jsonF("EventAuxiliary.id_.subRun_.subRun_"));
  header.add("event" ,fEvt.getGlobalHeaderPtr()->getEventNumber());

  header.add("isRealData", fEvt.getGlobalHeaderPtr()->getRecordOrigin());
  
  // // Todo: build these into a proper javascript-style timestamp.
  // double tlow = ftr.getF("EventAuxiliary.time_.timeLow_");
  // double thigh = ftr.getF("EventAuxiliary.time_.timeHigh_");
  // header.add("timeLow",tlow);
  // header.add("timeHigh",thigh);
  // header.add("isRealData",ftr.jsonF("EventAuxiliary.isRealData_"));
  // header.add("experimentType",ftr.jsonF("EventAuxiliary.experimentType_"));
  // 
  // // Add my own things. 
  // // FIXME: this should come from the event data, not be hardcoded, but this will have to do for the moment.
  // header.add("TDCStart",0);
  // header.add("TDCEnd",3200);
  
  fOutput.add("header",header);
}



void wireOfChannel(int channel, int& plane, int& wire)
{
  if(channel < 2399) {
    plane = 0; wire= channel; return;
  }
  else if(channel <4798) {
    plane = 1; 
    wire = channel - 2399;
    return;
  }
  else{
    plane = 2;
    wire= channel-4798;
    return;
  }
}



void RecordComposer::composeRaw()
{
  //get the seb map, and do a loop over all sebs/crates
  const std::map<crateHeader,crateData,compareCrateHeader>* seb_map = fEvt.getSEBMapPtr();

  std::cout << "\nseb_map: " << seb_map->size() << "\n";

  std::map<crateHeader,crateData>::const_iterator seb_it;
  for( seb_it = seb_map->begin(); seb_it != seb_map->end(); seb_it++){

    //get the crateHeader/crateData objects
    crateHeader crate_header = seb_it->first;
    crateData crate_data = seb_it->second;
    
    //can check some things in the crate header
    std::cout << "\nFrom crate header, crate (number,event,frame) is ... (" << std::dec
        << (unsigned int)crate_header.getCrateNumber() << ","
        << crate_header.getCrateEventNumber() << ","
        << crate_header.getCrateFrameNumber() << ")" <<std::endl;
    

    std::map<cardHeader,cardData>::iterator card_it;
    std::map<cardHeader,cardData,compareCardHeader> card_map = crate_data.getCardMap();
    for(card_it = card_map.begin(); card_it != card_map.end(); card_it++){
      //get the cardHeader/cardData objects
      cardHeader card_header = card_it->first;
      cardData card_data = card_it->second;
      //now get the channel map (for the current card), and do a loop over all channels
      std::map<int,channelData> channel_map = card_data.getChannelMap();
      std::map<int,channelData>::iterator channel_it;
      for(channel_it = channel_map.begin(); channel_it != channel_map.end(); channel_it++){
  
        //get the channel number and channelData
        int ch_num = channel_it->first;
        channelData chD = channel_it->second;
          std::cout <<  Form("%6d 0x%6x %3d",
            crate_header.getCrateNumber(),
            card_header.getIDAndModuleWord(),
            ch_num) 
            << "        ";
          int nsample = chD.getChannelDataSize()/sizeof(uint16_t);
          int i0 = *(uint16_t*)(chD.getChannelDataPtr());
          for(int j=1;j<nsample;j++) {
            int i1 = *(uint16_t*)(chD.getChannelDataPtr()+j*sizeof(uint16_t));
            if(abs(i1-i0)>5) cout << std::dec << j << "|" << std::hex << i1 << "  " ;
          }
          std::cout << endl;
          
          // Figure out what wire this is.
          // I have no idea how to do this, so I'll just guess.
          // 
          
        
      } // end channels
    }// end cards
  } // end crates
        
    // 
  // 
  // vector<string> leafnames = findLeafOfType("vector<raw::RawDigit>");
  // if(leafnames.size()==0) {
  //   fOutput.add("raw_warning","No raw::RawDigit branch found in file.");
  //   return;
  // } 
  // if(leafnames.size()>1) {
  //   fOutput.add("raw_warning","More than one raw::RawDigit list found!");
  // } 
  // 
  // std::string name = leafnames[0];
  // std::cout << "Looking at raw::RawDigit object " << (name+"obj_").c_str() << endl;
  // TLeaf* lf = fTree->GetLeaf((name+"obj_").c_str());
  // if(!lf) return;
  // int ndig = lf->GetLen();
  //   
  // JsonObject r;
  // ColorMap colormap;
  // 
  // TreeElementLooter l(fTree,name+"obj.fADC");
  // if(!l.ok()) return;
  // const std::vector<short> *ptr = l.get<std::vector<short>>(0);
  // // FIXME: Naive assumption that all vectors will be this length. Will be untrue for compressed or decimated data!
  // size_t width = ptr->size();
  // 
  // MakePng png(width,ndig, MakePng::palette_alpha,fPalette,fPaletteTrans);
  // MakePng epng(width,ndig,MakePng::rgb);
  // std::vector<unsigned char> imagedata(width);
  // std::vector<unsigned char> encodeddata(width*3);
  // 
  // TH1D timeProfile("timeProfile","timeProfile",width,0,width);
  // std::vector<TH1*> planeProfile;
  // planeProfile.push_back(new TH1D("planeProfile0","planeProfile0",2398,0,2398));
  // planeProfile.push_back(new TH1D("planeProfile1","planeProfile1",2398,0,2398));
  // planeProfile.push_back(new TH1D("planeProfile2","planeProfile2",3456,0,3456));
  // 
  // 
  // for(int i=0;i<ndig;i++) {
  //   ptr= l.get<std::vector<short>>(i);
  //   std::vector<short>::iterator it;
  //   double wiresum = 0;
  //   
  //   for(size_t k = 0; k<width; k++) {
  //     short raw = (*ptr)[k];
  //     // colormap.get(&imagedata[k*3],float(raw)/4000.);
  //     imagedata[k] = tanscale(raw);
  //     
  //     // Save bitpacked data as image map.
  //     int iadc = raw + 0x8000;
  //     encodeddata[k*3]   = 0xFF&(iadc>>8);
  //     encodeddata[k*3+1] = iadc&0xFF;
  //     encodeddata[k*3+2] = 0;
  //     double val = fabs(raw);
  //     wiresum += val;
  //     timeProfile.Fill(k,val);
  //   }
  //   png.AddRow(imagedata);
  //   epng.AddRow(encodeddata);
  // 
  //   int wire, plane;
  //   wireOfChannel(i,plane,wire);
  //   planeProfile[plane]->Fill(wire,wiresum);
  // 
  // }
  // png.Finish();
  // epng.Finish();
  // 
  // std::string wireimg = png.writeToUniqueFile(sfFileStoragePath);
  // std::string wireimg_thumb = wireimg+".thumb.png";
  // BuildThumbnail(sfFileStoragePath+wireimg,sfFileStoragePath+wireimg_thumb);
  // r.add("wireimg_url",sfUrlToFileStorage+wireimg);
  // r.add("wireimg_url_thumb",sfUrlToFileStorage+wireimg_thumb);
  // r.add("wireimg_encoded_url",sfUrlToFileStorage+
  //                           epng.writeToUniqueFile(sfFileStoragePath)
  //                           );
  // 
  // r.add("timeHist",TH1ToHistogram(&timeProfile));
  // JsonArray jPlaneHists;
  // jPlaneHists.add(TH1ToHistogram(planeProfile[0]));
  // jPlaneHists.add(TH1ToHistogram(planeProfile[1]));
  // jPlaneHists.add(TH1ToHistogram(planeProfile[2]));
  // r.add("planeHists",jPlaneHists);
  // 
  // delete planeProfile[0];
  // delete planeProfile[1];
  // delete planeProfile[2];
 
  JsonObject r;
  fOutput.add("raw",r);
}



void RecordComposer::compose()
{
  fOutput.add("converter","ComposeResult.cpp $Revision$ $Date$ ");

  // parse options.
  int doCal = 1;
  int doRaw = 1;
  if( std::string::npos != fOptions.find("_NOCAL_")) doCal = 0;
  if( std::string::npos != fOptions.find("_NORAW_")) doRaw = 0;

  
  composeHeaderData();

  // Wire data.
  // Start first so background image conversion tasks can be started as we build the rest.
  // if(doCal) composeCal();
  if(doRaw) composeRaw();
  
  
}



