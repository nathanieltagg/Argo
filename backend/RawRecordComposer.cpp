//
// Code for the Arachne Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

#include <TTree.h>
#include <TLeaf.h>
#include <TFile.h>
#include <TROOT.h>
#include <TH1F.h>
#include <TH1D.h>
#include <TLorentzVector.h>
#include "TBranchElement.h"
#include "TStreamerInfo.h"

#include "TVirtualCollectionProxy.h"

#include <iostream>
#include <fstream>
#include <sstream>
#include <vector>
#include <algorithm>
#include <time.h>
#include <math.h>
#include <stdio.h>
#include <TTreeFormula.h>

#include "RawRecordComposer.h"
#include "JsonElement.h"
#include "ColorMap.h"
#include "MakePng.h"
#include "RootToJson.h"
#include "WirePalette.h"
#include <stdlib.h>
#include <sys/stat.h>

#include "datatypes/eventRecord.h"

using namespace std;
using namespace gov::fnal::uboone::datatypes;
using gov::fnal::uboone::online::Plexus;



RawRecordComposer::RawRecordComposer(JsonObject& output,   
                                      std::shared_ptr<gov::fnal::uboone::datatypes::eventRecord> record, 
                                      const std::string options)
  : fOutput(output)
  , fRecord(record)
  , fOptions(options)
  , fmintdc(0)
  , fmaxtdc(0)
  , fPlexus()

{
  fPlexus.buildHardcoded();
  //fPlexus.buildFromPostgresql("postgresql","host=fnalpgsdev.fnal.gov port=5436 dbname=uboonedaq_dev user=uboonedaq_web password=argon!uBooNE")

  fCacheStoragePath     = "../live_event_cache";
  fCacheStorageUrl      = "live_event_cache";
  fCurrentEventDirname  = "live";
};
  
RawRecordComposer::~RawRecordComposer()
{
}


void RawRecordComposer::compose()
{
  // have the record unpack itself.
  fRecord->updateIOMode(IO_GRANULARITY_CHANNEL);
  
  std::string id = Form("r%08d_s%04d_e%08d"
                            ,fRecord->getGlobalHeaderPtr()->getRunNumber()    
                            ,fRecord->getGlobalHeaderPtr()->getSubrunNumber() 
                            ,fRecord->getGlobalHeaderPtr()->getEventNumber()  
                            );
  fCurrentEventDirname = Form("%s/%s.working/" // Will get renamed to .event on closeout.
                            ,fCacheStoragePath.c_str(), id.c_str());
  fCurrentEventUrl      = Form("%s/%s.event/"
                            ,fCacheStorageUrl.c_str(), id.c_str());
  
  mkdir(fCurrentEventDirname.c_str(),0777);
  composeHeader();
  composeTPC();
  composePMTs();

}

void RawRecordComposer::composeHeader()
{
  JsonObject header;
  header.add("run"     ,fRecord->getGlobalHeaderPtr()->getRunNumber()    );
  header.add("subrun"  ,fRecord->getGlobalHeaderPtr()->getSubrunNumber() );
  header.add("event"   ,fRecord->getGlobalHeaderPtr()->getEventNumber()  );
  header.add("triggerword"   , fRecord->getTriggerDataPtr()->getTrigEventType() );

  header.add("seconds",fRecord->getGlobalHeader().getSeconds());
  header.add("milliSeconds",fRecord->getGlobalHeader().getMilliSeconds());
  header.add("microSeconds",fRecord->getGlobalHeader().getMicroSeconds());
  header.add("nanoSeconds",fRecord->getGlobalHeader().getNanoSeconds());
  int daqSec = fRecord->getGlobalHeader().getSeconds();
  int daqNanoSec = (fRecord->getGlobalHeader().getMilliSeconds()*1000000)
                 + (fRecord->getGlobalHeader().getMicroSeconds()*1000) // FIXME: Not sure if right.
                 + (fRecord->getGlobalHeader().getNanoSeconds()); // FIXME: Not sure if right.
  double daqtime = daqSec*1000 + daqNanoSec*1e-9;
  
  header.add("daqTime",daqtime);
  header.add("recordOrigin", fRecord->getGlobalHeaderPtr()->getRecordOrigin());
  
  // Add my own things. 
  // FIXME: this should come from the event data, not be hardcoded, but this will have to do for the moment.
  header.add("TDCStart",fmintdc); // get from raw wire info.
  header.add("TDCEnd",fmaxtdc);
  
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
  
void RawRecordComposer::composeTPC()
{
  if(!fPlexus.is_ok()) cerr << "Plexus not loaded!" << std::endl;
  // The big wire map.
  typedef std::vector<int16_t> waveform_t;
  typedef std::shared_ptr<waveform_t> waveform_ptr_t;
  typedef std::map<int, waveform_ptr_t > wiremap_t;
    
  JsonObject jTPC;
  JsonArray jCrates;

  wiremap_t wireMap;
  int ntdc = 0;
  
  int wires_read = 0;
  // Loop through all channels.
  std::map<crateHeader,crateData,compareCrateHeader> seb_map = fRecord->getSEBMap();
  std::map<crateHeader,crateData,compareCrateHeader>::iterator seb_it;
  for( seb_it = seb_map.begin(); seb_it != seb_map.end(); seb_it++){
    //get the crateHeader/crateData objects
    crateHeader crate_header = seb_it->first;
    crateData crate_data = seb_it->second;
    int crate = crate_header.getCrateNumber();

    JsonArray jCards;

      //now get the card map (for the current crate), and do a loop over all cards
      std::map<cardHeader,cardData>::iterator card_it;
      std::map<cardHeader,cardData,compareCardHeader> card_map = crate_data.getCardMap();
      for(card_it = card_map.begin(); card_it != card_map.end(); card_it++){
    
        cardHeader card_header = card_it->first;
        cardData card_data = card_it->second;
        int card = card_header.getID();
        
        JsonObject jCard;
        jCard.add("cardId",crate);
        int num_card_channels = 0;
        
        
        std::map<int,channelData> channel_map = card_data.getChannelMap();
        std::map<int,channelData>::iterator channel_it;
        for(channel_it = channel_map.begin(); channel_it != channel_map.end(); channel_it++){

          int channel       = channel_it->first;
          channelData& data = channel_it->second;
          
          num_card_channels++;
          // Find the wire number of this channel.
          Plexus::PlekPtr_t p = fPlexus.get(crate,card,channel);
          int wire = p->wirenum();
          // std::cout << "found wire " << wire << std::endl;
          if(wire<0) continue;

          // FIXME: not right for huffman.
          int nsamp = data.getChannelDataSize()/sizeof(uint16_t);

          // Waveform storage.
          std::pair<wiremap_t::iterator,bool> inserted;
          waveform_ptr_t waveform_ptr = waveform_ptr_t(new waveform_t(nsamp));
          inserted = wireMap.insert(wiremap_t::value_type(wire, waveform_ptr));
          if(!inserted.second) {
            cerr << "Two channels with wire number " << wire << " seem to have the same crate/card/channel map." << endl;
            continue;
          }
          waveform_t& waveform = *(inserted.first->second.get());
                  
          // Copy the channel data to my own signed vector array
          // FIXME: do huffman decoding or decimation recover here!
          uint16_t* rawdata = (uint16_t*)(data.getChannelDataPtr());
          for(int i=0;i<nsamp;i++) waveform[i] = rawdata[i];
          
          wires_read++;
          if(ntdc<nsamp) ntdc = nsamp;
          
          // Find the pedestal manually.
          // FIXME: add configurable hook to look up.
          // Histogram of values:
          vector<uint16_t> histogram(0x1000,0);
          int16_t pedestal = 0;
          uint16_t max_counts = 0;
          for(int i=0;i<nsamp;i++){
            int bin = waveform[i]&0xFFF;
            int counts = ++histogram[bin];
            if(counts > max_counts) { max_counts = counts; pedestal = bin;}
          } 
          
          // subtract ped.
          for(int i=0;i<nsamp;i++){
            waveform[i] -= pedestal;
          }
        } // loop channels

        jCard.add("num_channels",num_card_channels);
        jCards.add(jCard);        
      } // loop cards
      
      JsonObject jCrate;
      jCrate.add("cards",jCards);
      jCrate.add("crateNumber",crate_header.getCrateNumber());
      jCrate.add("cardCount",crate_header.getCardCount());
      jCrate.add("sebSec",crate_header.getSebTimeSec());
      jCrate.add("sebUsec",crate_header.getSebTimeUsec());
      jCrate.add("type",crate_header.getCrateType());
      jCrate.add("eventNumber",crate_header.getCrateEventNumber());
      jCrate.add("frameNumber",crate_header.getCrateFrameNumber());
      jCrate.add("cardCount",crate_header.getCardCount());
      jCrates.add(jCrate);
      
  } // loop seb/crate
  
  // Now we should have a semi-complete map.
  // Make the output.
  fmintdc = 0;
  fmaxtdc = ntdc;

  if(wires_read<=0) { cerr << "Got no wires!" << std::endl; return;}
  int nwire = 8254;
  ColorMap colormap;
  MakePng png (ntdc,nwire, MakePng::palette_alpha,WirePalette::gWirePalette->fPalette,WirePalette::gWirePalette->fPaletteTrans);
  MakePng epng(ntdc,nwire,MakePng::rgb);
  std::vector<unsigned char> imagedata(ntdc);
  std::vector<unsigned char> encodeddata(ntdc*3);

  TH1D timeProfile("timeProfile","timeProfile",ntdc,0,ntdc);
  std::vector<TH1*> planeProfile;
  std::vector<Double_t> timeProfileData(ntdc+2,0);
  planeProfile.push_back(new TH1D("planeProfile0","planeProfile0",2398,0,2398));
  planeProfile.push_back(new TH1D("planeProfile1","planeProfile1",2398,0,2398));
  planeProfile.push_back(new TH1D("planeProfile2","planeProfile2",3456,0,3456));

  // std::vector<TH1*> planeHistogram;
  // planeHistogram.push_back(new TH1D("planeHistogram0","planeHistogram0",2398,0,2398));
  // planeHistogram.push_back(new TH1D("planeHistogram1","planeHistogram1",2398,0,2398));
  // planeHistogram.push_back(new TH1D("planeHistogram2","planeHistogram2",3456,0,3456));

  // waveform_t blank(ntdc,0);
  for(int wire=0;wire<nwire;wire++) 
  {
    // waveform_t& waveform = blank;
    wiremap_t::iterator it = wireMap.find(wire);
    if(it != wireMap.end()) {
      // We have a good wire recorded.0
      waveform_t& waveform = *(it->second.get());

      double wiresum = 0;
      for(int k=0;k<ntdc;k++) {
        short raw = waveform[k];
        // colormap.get(&imagedata[k*3],float(raw)/4000.);
        imagedata[k] = WirePalette::gWirePalette->tanscale(raw);
        // Save bitpacked data as image map.
        int iadc = raw + 0x8000;
        encodeddata[k*3]   = 0xFF&(iadc>>8);
        encodeddata[k*3+1] = iadc&0xFF;
        encodeddata[k*3+2] = 0;
        double val = fabs(raw);
        wiresum += val;
        //timeProfile.Fill(k,val);
        timeProfileData[k+1] += val;
      }
      png.AddRow(imagedata);
      epng.AddRow(encodeddata);
      
      int plane, planewire;
      wireOfChannel(wire,plane,planewire);
      planeProfile[plane]->Fill(planewire,wiresum);
    } else {
      // Do not have wire info.
      
      for(int k=0;k<ntdc;k++) {
        imagedata[k] = 255; // Saturate!
        // Save bitpacked data as image map.
        encodeddata[k*3]   = 0;
        encodeddata[k*3+1] = 0;
        encodeddata[k*3+2] = 0;
      }
      png.AddRow(imagedata);
      epng.AddRow(encodeddata);      
    }
    
  }
  timeProfile.SetContent(&timeProfileData[0]);
  png.Finish();
  epng.Finish();
  std::string wireimg = png.writeToUniqueFile(fCurrentEventDirname);
  std::string wireimg_thumb = wireimg+".thumb.png";
  BuildThumbnail(fCurrentEventDirname+wireimg,fCurrentEventDirname+wireimg_thumb);

  JsonObject r;
  r.add("wireimg_url",fCurrentEventUrl+wireimg);
  r.add("wireimg_url_thumb",fCurrentEventUrl+wireimg_thumb);
  r.add("wireimg_encoded_url",fCurrentEventUrl+
                            epng.writeToUniqueFile(fCurrentEventDirname)
                            );

  r.add("timeHist",TH1ToHistogram(&timeProfile));
  JsonArray jPlaneHists;
  jPlaneHists.add(TH1ToHistogram(planeProfile[0]));
  jPlaneHists.add(TH1ToHistogram(planeProfile[1]));
  jPlaneHists.add(TH1ToHistogram(planeProfile[2]));
  r.add("planeHists",jPlaneHists);

  delete planeProfile[0];
  delete planeProfile[1];
  delete planeProfile[2];

  JsonObject reco_list;
  reco_list.add("DAQ",r);
  fOutput.add("raw",reco_list);
    
  jTPC.add("crates",jCrates);
  fOutput.add("tpc",jTPC);
  
}

uint32_t resolveFrame(uint32_t frameCourse,uint32_t frameFine, uint32_t bitmask)
{
  /// 
  /// Figure out the correct roll-over.  Given a frame number frameCourse which is usually the
  /// event readout frame, figure out which absolute frame number should be assigned to frameFine, 
  /// which contains only <bitmask> bits of specific information.
  /// eg. (0x100,0x1,0xf) resolves to 0x101, which is the nearest solution,
  /// but (0x100,0xe,0xF) resolves to 0x9e, which is closer.
  ///
  // note that modulus = bitmask + 1. E.g. bitmask=0x7 means modulus-8 arithmetic.
  // This could probably be optimized, but my brain is a little fuzzy today.
  uint32_t option1 = (frameCourse - (frameCourse & bitmask)) | (frameFine & bitmask);
  int max = (bitmask+1)/2; // This is half-way point; you should never be further than this.
  int diff = option1-frameCourse;
  if(diff >  max) return option1 - (bitmask+1);
  if(diff < -max) return option1 + (bitmask+1);
  return option1;
}


void RawRecordComposer::getPmtFromCrateCardChan(
  int icrate, int icard,int ichan, // channel input
  int& outPmt,  // pmt or optical detector number
  int& outGain, // gain of channel 1=low, 2=high
  std::string& outSpecial // special name
    )
{
  // This function is totally bogus, but it will at least give me a framework.
  (void)icrate; // unused parameter
  
  // if(icard<7) {
  //   outGain = -1;
  //   outPmt = -1;
  //   outSpecial = "";
  //   return;
  // }
  if(ichan<30) {    
    if(icard>7) outGain = 1; // low gain
    else        outGain = 2; // high gain
    outPmt = ichan;
  } 
  else {   
    outGain = -1;
    outPmt = -1;
    outSpecial = std::string("special_").append(std::to_string(ichan));
  }
  
}
  
void RawRecordComposer::composePMTs()
{
  uint32_t  pmt_readout_frame_mod8  = 0xFFFFFFFF;
  uint32_t  pmt_readout_frame = 0xFFFFFFFF;
  uint32_t  pmt_readout_sample = 0xFFFFFFFF;

  JsonArray ophits;

  JsonArray jCrates;
  
  const eventRecord::sebMapPMT_t& pmt_map = fRecord->getSEBPMTMap();
  eventRecord::sebMapPMT_t::const_iterator pmt_it;
  for( pmt_it = pmt_map.begin(); pmt_it != pmt_map.end(); pmt_it++){
    //get the crateHeader/crateData objects
    const crateHeader& crate_header = pmt_it->first;
    const crateDataPMT& crate_data = pmt_it->second;
    int crate = crate_header.getCrateNumber();

    //now get the card map (for the current crate), and do a loop over all cards
    const crateDataPMT::cardMap_t&  card_map = crate_data.getCardMap();
    crateDataPMT::cardMap_t::const_iterator card_it;

    JsonArray jCards;
    
    // Loop cards
    for(card_it = card_map.begin(); card_it != card_map.end(); card_it++){    
      const cardHeaderPMT& card_header = card_it->first;
      const cardDataPMT&   card_data   = card_it->second;
      int card = card_header.getModule();
      
      uint32_t pmt_event_frame      = card_header.getFrame();
      uint32_t pmt_trig_frame_mod16 = card_header.getTrigFrameMod16();
      uint32_t pmt_trig_frame       = card_header.getTrigFrame(); // The resolved version, fully specified.
      uint32_t pmt_trig_sample_2MHz = card_header.getTrigSample();
      
      std::map<int,channelDataPMT> channel_map = card_data.getChannelMap();
      std::map<int,channelDataPMT>::iterator channel_it;

      
      JsonArray jChannels;

      // Loop channels
      for(channel_it = channel_map.begin(); channel_it != channel_map.end(); channel_it++){
  
        int channel = channel_it->first;
        const channelDataPMT& data = channel_it->second;
        int pmt;
        int gain;
        std::string special;
        getPmtFromCrateCardChan(crate, card, channel, pmt, gain, special);
        
        int nwindows = 0;
        // Loop windows.
        const channelDataPMT::windowMap_t& windows = data.getWindowMap();
        channelDataPMT::windowMap_t::const_iterator it;
        for(it = windows.begin(); it != windows.end(); it++) {
          nwindows ++;
          const windowHeaderPMT& window_header = it->first;
          int disc = window_header.getDiscriminant();
          // if((disc&0x3)>0)      nwindows_disc++;
          // if((disc&0x4) == 0x4) nwindows_beam++;

          uint32_t frame = resolveFrame(pmt_event_frame,window_header.getFrame(),0x7);
          uint32_t sample = window_header.getSample();
          if( (pmt_readout_frame==0xFFFFFFFF) && ((window_header.getDiscriminant()&0x4)==4) ) {
            // Set the readout start time here.
            pmt_readout_frame_mod8  = window_header.getFrame();
            pmt_readout_frame = frame;
            pmt_readout_sample = sample;
          }
          const windowDataPMT&   window_data   = it->second;
          const uint16_t* ptr = (uint16_t*) (window_data.getWindowDataPtr());
          int nsamp = window_data.getWindowDataSize()/sizeof(uint16_t);
          int peaksamp = 0;
          int peakval = 0;
          int ped = ptr[0]&0xfff;
          double sumw  = 0;
          double sumwx = 0;
          double sumwxx = 0;
          for(int j=0;j<nsamp;j++) {
            double val = (ptr[j]&0xfff) - ped;
            sumw += val;
            sumwx += val*j;
            sumwxx += val*j*j;
            if(val>peakval) {peakval = val; peaksamp = j;}
          }
          if(sumw==0) sumw = 1e-9;
          double meanTime = sumwx/sumw;
          double widthTime = sqrt(fabs(sumwxx/sumw - meanTime*meanTime));
          double peakTime = ( ((frame-pmt_readout_frame)*102400.) + (peaksamp+sample-pmt_readout_sample) ) / 64e6; // 64 mhz ticks
          
        
          double pe = sumw/2;       // Crude calibration: 2 ADC/pe low gain
          if(gain==2) pe = sumw/20; // 20 ADC/pe high gain
          
          JsonObject jobj;
          jobj.add("ccc"     ,(crate*1000 + card)*1000+channel);      
          jobj.add("opDetChan"     ,pmt);
          jobj.add("opDetGain"     ,gain);          
          if(special.length()>0) 
            jobj.add("opDetSpecial"  ,special);          
          jobj.add("disc",disc);
          jobj.add("peakTime"      ,peakTime*1e9); // nanoseconds
          jobj.add("pe"            ,pe);
          jobj.add("sample", sample);
          jobj.add("frame",frame);
          ophits.add(jobj);
                    
        }
        
        JsonObject jChannel;
        jChannel.add("channel",channel);
        jChannel.add("nwindows",nwindows);
        jChannel.add("pmt",pmt);
        jChannel.add("gain",gain);
        if(special.length()) jChannel.add("special",special);
        jChannels.add(jChannel);
  
      } // loop channels
      
      JsonObject jCard;
      jCard.add("card",card);
      jCard.add("channels",jChannels);
      jCards.add(jCard);
    } // loop cards

    JsonObject jCrate;
    jCrate.add("cards",jCards);
    jCrate.add("crateNumber",crate_header.getCrateNumber());
    jCrate.add("cardCount",crate_header.getCardCount());
    jCrate.add("sebSec",crate_header.getSebTimeSec());
    jCrate.add("sebUsec",crate_header.getSebTimeUsec());
    jCrate.add("type",crate_header.getCrateType());
    jCrate.add("eventNumber",crate_header.getCrateEventNumber());
    jCrate.add("frameNumber",crate_header.getCrateFrameNumber());
    jCrate.add("cardCount",crate_header.getCardCount());
    jCrates.add(jCrate);
    
  } // Loop PMT crates
  JsonObject reco_list;
  reco_list.add("DAQ",ophits);
  fOutput.add("ophits",reco_list);
  
  JsonObject jPMT;
  jPMT.add("crates",jCrates);   
  fOutput.add("ophits",reco_list);   
  fOutput.add("PMT",jPMT);   
}
  
