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
#include "TimeReporter.h"
#include "ColorMap.h"
#include "MakePng.h"
#include "EncodedTileMaker.h"
#include "RootToJson.h"
#include "WirePalette.h"
#include <stdlib.h>
#include <sys/stat.h>

#include "datatypes/ub_EventRecord.h"

#include "boost/thread/thread.hpp"

using namespace std;
using namespace gov::fnal::uboone::datatypes;
using gov::fnal::uboone::online::Plexus;

gov::fnal::uboone::online::Plexus gPlexus;


RawRecordComposer::RawRecordComposer(JsonObject& output,   
                                      std::shared_ptr<gov::fnal::uboone::datatypes::ub_EventRecord> record, 
                                      const std::string options)
  : fOutput(output)
  , fRecord(record)
  , fOptions(options)
  , fCreateSubdirCache (true)
  , fmintdc(0)
  , fmaxtdc(0)
{

  fCacheStoragePath     = "../live_event_cache";
  fCacheStorageUrl      = "live_event_cache";
  fWorkingSuffix = "working";
  fFinalSuffix   = "event";
};
  
RawRecordComposer::~RawRecordComposer()
{
}


void RawRecordComposer::compose()
{
  // have the record unpack itself.
  //fRecord->updateIOMode(IO_GRANULARITY_CHANNEL);
  if(!fRecord) {
    fOutput.add("error","Bad record!");
    return;
  } 
  
  std::string id = Form("r%08d_s%04d_e%08d"
                            ,fRecord->getGlobalHeader().getRunNumber()    
                            ,fRecord->getGlobalHeader().getSubrunNumber() 
                            ,fRecord->getGlobalHeader().getEventNumber()  
                            );
  
  if(fCreateSubdirCache) {
    fCurrentEventDirname = Form("%s/%s.%s/" // Will get renamed to .event on closeout.
                              ,fCacheStoragePath.c_str(), id.c_str(),fWorkingSuffix.c_str());
    fCurrentEventUrl      = Form("%s/%s.%s/"
                              ,fCacheStorageUrl.c_str(), id.c_str(),fFinalSuffix.c_str());
  
    ::umask(0000); // need this first??
    ::mkdir(fCurrentEventDirname.c_str(),0777);
  } else {
    fCurrentEventDirname = fCacheStoragePath;
    fCurrentEventUrl     = fCacheStorageUrl;
  }
  composeHeader();
  composeTPC();
  composePMTs();
  fOutput.add("stats",fStats);
  

}


 
  
void getTime(std::shared_ptr<gov::fnal::uboone::datatypes::ub_EventRecord> record, JsonObject& header)
{
  // check the event header.
  uint32_t sec = record->getGlobalHeader().getSeconds();
  uint32_t usec= record->getGlobalHeader().getMicroSeconds();
  uint32_t nsec= record->getGlobalHeader().getNanoSeconds();
  
  // Fixme: look at GPS 
  
  if(sec < 1350000000) {
    // Get the time from a trigger crate.
    const ub_EventRecord::trig_map_t map = record->getTRIGSEBMap();
    if(map.size()>0) {
      auto const& cratedata = map.begin()->second;
      auto const& ch = cratedata.crateHeader();
      sec = ch->local_host_time.seb_time_sec;
      usec = ch->local_host_time.seb_time_usec;      
      nsec = ch->local_host_time.seb_time_usec*1000;
    }
  }
  
  if(sec < 1350000000) {
    // Get the time from PMT crate.
    const ub_EventRecord::pmt_map_t map = record->getPMTSEBMap();
    if(map.size()>0) {
      auto const& cratedata = map.begin()->second;
      auto const& ch = cratedata.crateHeader();
      sec = ch->local_host_time.seb_time_sec;
      usec = ch->local_host_time.seb_time_usec;      
      nsec = ch->local_host_time.seb_time_usec*1000;
    }
  }
  
  if(sec < 1350000000) {
    // Get the time from PMT crate.
    const ub_EventRecord::tpc_map_t map = record->getTPCSEBMap();
    for(auto it:map) {
      auto const& cratedata = it.second;
      auto const& ch = cratedata.crateHeader();
      sec = ch->local_host_time.seb_time_sec;
      usec = ch->local_host_time.seb_time_usec;      
      nsec = ch->local_host_time.seb_time_usec*1000;      
    }
  }
  
  header.add("seconds",sec);
  header.add("microSeconds",usec);
  header.add("nanoSeconds",nsec);
  double daqtime = sec*1000 + nsec*1e-9;
  
  header.add("daqTime",daqtime);

}

  
bool getTriggerData(std::shared_ptr<gov::fnal::uboone::datatypes::ub_EventRecord> record, JsonObject& trig)
{
  
   // get trigger card data.
  const ub_EventRecord::trig_map_t trigmap = record->getTRIGSEBMap();
  if(trigmap.size()==0) {
    return false;
  }
  auto const& trigger = record->getTRIGSEBMap().begin()->second;
  auto const& ch = trigger.crateHeader();
  auto const& trigger_cards = trigger.getCards();
  trig.add("trigger_cards",trigger_cards.size());
  // Fixme: look at GPS 
  if(trigger_cards.size()<1) return true;;
  auto const& trigger_header = trigger_cards.begin()->header();
  auto const& trigger_channels = trigger_cards.begin()->getChannels();
  if(trigger_channels.size()<1) return true;;
  auto const& trigger_data = trigger_channels.begin()->header();
  
  trig.add("triggerword",(trigger_data.trig_data_1 & 0x7FFF));
  trig.add("frame",trigger_header.getFrame());
  trig.add("sample_2MHz",trigger_header.get2MHzSampleNumber());
  trig.add("sample_16MHz",((trigger_header.get2MHzSampleNumber())<<3) + trigger_header.get16MHzRemainderNumber());

}



void RawRecordComposer::composeHeader()
{
  JsonObject header;

  // GET THE TIME
  getTime(fRecord,header);

  header.add("run"           ,fRecord->getGlobalHeader().getRunNumber()    );
  header.add("subrun"        ,fRecord->getGlobalHeader().getSubrunNumber() );
  header.add("event"         ,fRecord->getGlobalHeader().getEventNumber()  );
  
  
  // Get trigger info.
  
  // header.add("seconds",fRecord->getGlobalHeader().getSeconds());
  // header.add("microSeconds",fRecord->getGlobalHeader().getMicroSeconds());
  // header.add("nanoSeconds",fRecord->getGlobalHeader().getNanoSeconds());
  header.add("recordOrigin", fRecord->getGlobalHeader().getRecordOrigin());
  
  
  // trigger data.
  JsonObject trig;
  getTriggerData(fRecord,trig);
  header.add("trigger",trig);
  
  
  fOutput.add("header",header);  
}
  
 

 
void RawRecordComposer::composeTPC()
{
  JsonObject reco_list;
  JsonObject r;
  
  if(!gPlexus.is_ok()) cerr << "Plexus not loaded!" << std::endl;
  // The big wire map.
    
  JsonObject jTPC;
  JsonArray jCrates;

  std::shared_ptr<wiremap_t> wireMap(new wiremap_t);
  int ntdc = 0;
  TimeReporter timer("TPC");    
  
  int wires_read = 0;
  
  {
    TimeReporter timer_read("TPCReadDAQ");  
    
    // Loop through all channels.
    ub_EventRecord::tpc_map_t tpc_map = fRecord->getTPCSEBMap();
    for( ub_EventRecord::tpc_map_t::const_iterator crate_it = tpc_map.begin(); crate_it != tpc_map.end(); crate_it++){
      //get the crateHeader/crateData objects
      int crate = crate_it->first; // This seems more reliable than the crate daq header.
      const tpc_crate_data_t& crate_data = crate_it->second;
      std::unique_ptr<tpc_crate_data_t::ub_CrateHeader_t> const& crate_header = crate_data.crateHeader();

      JsonArray jCards;

      std::vector<tpc_crate_data_t::card_t> const& cards = crate_data.getCards();
      for(const tpc_crate_data_t::card_t& card_data: cards) {
        // const tpc_crate_data_t::card_t::ub_CardHeader_t& card_header = card_data.getHeader();
        int card = card_data.getModule();
      
        JsonObject jCard;
        jCard.add("cardId",crate);
        int num_card_channels = 0;
        
        const std::vector<tpc_crate_data_t::card_t::card_channel_type>& channels = card_data.getChannels();
        for( const tpc_crate_data_t::card_t::card_channel_type& channel_data : channels) {
          int channel       = channel_data.getChannelNumber();        
          num_card_channels++;
          // Find the wire number of this channel.
          const Plexus::Plek& p = gPlexus.get(crate,card,channel);
          int wire = p.wirenum();
          // std::cout << "found wire " << wire << std::endl;
          if(wire<0) continue;
          size_t nsamp = channel_data.data().size();

          // Waveform storage.
          std::pair<wiremap_t::iterator,bool> inserted;
          waveform_ptr_t waveform_ptr = waveform_ptr_t(new waveform_t(nsamp));
          inserted = wireMap->insert(wiremap_t::value_type(wire, waveform_ptr));
          if(!inserted.second) {
            cerr << "Two channels with wire number " << wire << " seem to have the same crate/card/channel map." << endl;
            continue;
          }
          waveform_t& waveform = *(inserted.first->second.get());
                  
          // Copy the channel data to my own signed vector array
          channel_data.decompress(waveform);
        
          wires_read++;
          if(ntdc<nsamp) ntdc = nsamp;
          
          // Find the pedestal manually.
          // FIXME: add configurable hook to look up.
          // Histogram of values:
          vector<uint16_t> histogram(0x1000,0);
          int16_t pedestal = 0;
          uint16_t max_counts = 0;
          for(int i=0;i<nsamp;i++){
            int bin = waveform[i];
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
      jCrate.add("crateNumber",crate);
      jCrate.add("sebSec",crate_header->local_host_time.seb_time_sec);
      jCrate.add("sebUsec",crate_header->local_host_time.seb_time_usec);
      jCrate.add("type",crate_header->crate_type);
      jCrate.add("eventNumber",crate_header->event_number);
      jCrate.add("frameNumber",crate_header->frame_number);
      jCrate.add("cardCount",crate_header->card_count);
      jCrates.add(jCrate);
      
    } // loop seb/crate
  
    timer_read.addto(fStats);
  }
  
  // Now we should have a semi-complete map.
  fmintdc = 0;
  fmaxtdc = ntdc;
  int nwire = 1 + wireMap->rbegin()->first;
  
  if(wires_read<=0) { cerr << "Got no wires!" << std::endl; return;}
  cout << "Read " << wires_read << " wires\n";
  MakeEncodedTileset(     r,
                          wireMap, 
                          nwire,
                          ntdc,
                          fCurrentEventDirname,
                          fCurrentEventUrl );

  reco_list.add("DAQ",r);
  fOutput.add("raw",reco_list);
    
  jTPC.add("crates",jCrates);
  fOutput.add("TPC",jTPC);
  
  timer.addto(fStats);
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
  TimeReporter timer("DAQPMTs");
  uint32_t  pmt_readout_frame_mod8  = 0xFFFFFFFF;
  uint32_t  pmt_readout_frame = 0xFFFFFFFF;
  uint32_t  pmt_readout_sample = 0xFFFFFFFF;

  JsonArray ophits;

  JsonArray jCrates;
  
  const ub_EventRecord::pmt_map_t& pmt_map = fRecord->getPMTSEBMap();
  ub_EventRecord::pmt_map_t::const_iterator crate_it;
  for( crate_it = pmt_map.begin(); crate_it != pmt_map.end(); crate_it++){
    //get the crateHeader/crateData objects
    int crate = crate_it->first;
    const pmt_crate_data_t& crate_data = crate_it->second;
    std::unique_ptr<pmt_crate_data_t::ub_CrateHeader_t> const& crate_header = crate_data.crateHeader();
    
  
    JsonArray jCards;
    //now get the card map (for the current crate), and do a loop over all cards
    std::vector<pmt_crate_data_t::card_t> const& cards = crate_data.getCards();
    for(const pmt_crate_data_t::card_t& card_data: cards) {
      
      const pmt_crate_data_t::card_t::header_type& card_header = card_data.header();
      int card = card_data.getModule();
      
      uint32_t pmt_event_frame      = card_data.getFrame();
      uint32_t pmt_trig_frame_mod16 = card_data.getTrigFrameMod16();
      uint32_t pmt_trig_frame       = card_data.getTrigFrame(); // The resolved version, fully specified.
      uint32_t pmt_trig_sample_2MHz = card_data.getTrigSample();
      
      JsonArray jChannels;

      // Loop channels
  
      const std::vector<pmt_crate_data_t::card_t::card_channel_type>& channels = card_data.getChannels();
      for( const pmt_crate_data_t::card_t::card_channel_type& channel_data : channels) {
  
        int channel = channel_data.getChannelNumber();
        int pmt;
        int gain;
        std::string special;
        getPmtFromCrateCardChan(crate, card, channel, pmt, gain, special);
        
        int nwindows = 0;
        // Loop windows.
        const std::vector<ub_PMT_WindowData_v6>& windows = channel_data.getWindows();
        for( const ub_PMT_WindowData_v6& window_data : windows) {
          nwindows ++;
          const ub_PMT_WindowHeader_v6& window_header = window_data.header();

          int disc = window_header.getDiscriminantor();
          // if((disc&0x3)>0)      nwindows_disc++;
          // if((disc&0x4) == 0x4) nwindows_beam++;

          uint32_t frame = resolveFrame(pmt_event_frame,window_header.getFrame(),0x7);
          uint32_t sample = window_header.getSample();
          if( (pmt_readout_frame==0xFFFFFFFF) && ((disc&0x4)==4) ) {
            // Set the readout start time here.
            pmt_readout_frame_mod8  = window_header.getFrame();
            pmt_readout_frame = frame;
            pmt_readout_sample = sample;
          }
          int nsamp = window_data.data().size();
          int peaksamp = 0;
          int peakval = 0;
          ub_RawData::const_iterator it = window_data.data().begin();
          int ped = (*it)&0xfff;
          double sumw  = 0;
          double sumwx = 0;
          double sumwxx = 0;
          for(int j=0;j<nsamp;j++) {
            double val = (*it&0xfff) - ped;
            it++;
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
    jCrate.add("crateNumber",crate_header->crate_number);
    jCrate.add("cardCount",crate_header->card_count);
    jCrate.add("sebSec",crate_header->local_host_time.seb_time_sec);
    jCrate.add("sebUsec",crate_header->local_host_time.seb_time_usec);
    jCrate.add("type",crate_header->crate_type);
    jCrate.add("eventNumber",crate_header->event_number);
    jCrate.add("frameNumber",crate_header->frame_number);
    jCrates.add(jCrate);
    
  } // Loop PMT crates
  JsonObject reco_list;
  reco_list.add("DAQ",ophits);
  fOutput.add("ophits",reco_list);
  
  JsonObject jPMT;
  jPMT.add("crates",jCrates);   
  fOutput.add("PMT",jPMT);   
  timer.addto(fStats);
}
  
