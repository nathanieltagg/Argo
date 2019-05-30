
#include "EncodedTileMaker.h"
#include "TimeReporter.h"
#include "TH1D.h"
#include "boost/thread/thread.hpp"
#include "wireOfChannel.h"
#include "json_tools.h"
#include "ThreadPool.h"
#include <sys/types.h>
#include <sys/stat.h>

// given an input wiremap,
// create the slew of output .pngs using crafty 
// threaded jobs


void MakeLowres(nlohmann::json& r,
              std::shared_ptr<wiremap_t> wireMap, 
              std::shared_ptr<wiremap_t> noiseWireMap, 
              size_t nwire,
              size_t nsamp,
              const std::string& path,
              const std::string& url,
              int tilesize,
              bool fill_empty_space,
              size_t max_threads)
{
  int factor_x =10;
  int factor_y =10;
  std::shared_ptr<wiremap_t> wireMap_out(new wiremap_t);
  std::shared_ptr<wiremap_t> noiseWireMap_out(new wiremap_t);
  
  
  // for each output 'wire'
  //   look up the 0..factor_y wires that are input.
  //   for each output tick
  //     for each input wire
  //       for each input wire tick 0..factor_x
  //          get biggest;
  //      push onto output wire
  //  push output wire
  //  encode.

  int nwire_out = nwire/factor_y;
  int nsamp_out = nsamp/factor_x;

  // for each output 'wire'
  for(int iwire_out = 0; iwire_out<nwire_out; iwire_out++) {
    waveform_ptr_t      waveform_ptr = waveform_ptr_t(new waveform_t(nsamp_out));
    waveform_ptr_t noiseWaveform_ptr = waveform_ptr_t(new waveform_t(nsamp_out));
    wireMap_out     ->push_back(waveform_ptr);
    noiseWireMap_out->push_back(noiseWaveform_ptr);
    waveform_t&      waveform =      *waveform_ptr;
    waveform_t& noiseWaveform = *noiseWaveform_ptr;

    
    for(int iwire_in = iwire_out*factor_y; (iwire_in < (iwire_out+1)*factor_y) && iwire_in<nwire; iwire_in++) {
      waveform_ptr_t      waveform_in_ptr=      (*wireMap)[iwire_in];
      waveform_ptr_t noiseWaveform_in_ptr= (*noiseWireMap)[iwire_in];
      
      // If the wire exists, and is not a bad channel...
      if(waveform_in_ptr && (waveform_in_ptr->_status<0 || waveform_in_ptr->_status>3)) {
        // if(!noiseWaveform_in_ptr) std::cout << " No noise waveform on " << iwire_in << std::endl;
        waveform._pedwidth = waveform_in_ptr->_pedwidth;
        for(int i=0;i<nsamp;i++) {
          if(     (*waveform_in_ptr)[i] >      waveform[i/factor_x])      waveform[i/factor_x] = (     *waveform_in_ptr)[i];
          if(noiseWaveform_in_ptr)
           if((*noiseWaveform_in_ptr)[i] > noiseWaveform[i/factor_x]) noiseWaveform[i/factor_x] = (*noiseWaveform_in_ptr)[i];
        }
      }  
    }  
  }
  EncodedTileMaker tm(wireMap_out, noiseWireMap_out, 0, nwire_out, 0, nsamp_out, path, url, fill_empty_space);
  tm.process();
  nlohmann::json jtiles;
  nlohmann::json jrow;
  jrow.push_back(tm.json());
  jtiles.push_back(jrow);      
  r.emplace("wireimg_scale_x",factor_x);
  r.emplace("wireimg_scale_y",factor_y);
  r.emplace("wireimg_encoded_tiles",jtiles);  
}



void MakeEncodedTileset(nlohmann::json& r,
                        std::shared_ptr<wiremap_t> wireMap, 
                        std::shared_ptr<wiremap_t> noiseWireMap, 
                        size_t nwire,
                        size_t ntdc,
                        const std::string& path,
                        const std::string& url,
                        int  tilesize,
                        bool fill_empty_space,
                        size_t max_threads)
{
  {
    TimeReporter timer_tiles("time_to_make_tiles");
    // create tiles.

    std::cout << "Doing tile threads."
        << "\n --storage: "  << path 
        << "\n --url:     "  << url 
        << "\n --Filling space: "  << fill_empty_space 
        << "\n --tilesize: " << tilesize  << std::endl;
    // boost::thread_group tile_threads;
    ThreadPool thread_pool(max_threads);
    
    typedef std::vector<EncodedTileMaker> row_t;
    typedef std::vector<row_t> table_t;
    
    table_t table;
    if(tilesize<=0) tilesize=2400;
    int rows = ceil((float)nwire/(float)tilesize);
    int cols = ceil((float)ntdc/(float)tilesize);
    std::cout << "Doing tilesize " << tilesize << " with " << rows << " x " << cols << std::endl;
    
    for(int i=0;i<rows;i++) {
      row_t row;
      for(int j=0;j<cols;j++) {
        int x1 = i*tilesize;
        int x2 = x1+tilesize;
        if(x2>nwire) x2=nwire;
        int y1 = j*tilesize;
        int y2 = y1+tilesize;
        if(y2>ntdc) y2=ntdc;
        std::cout << "tile" << x1 << " " << x2 << " " << y1 << " " << y2 << std::endl;
        row.push_back(EncodedTileMaker(wireMap, noiseWireMap, x1,x2, y1,y2, path, url,fill_empty_space));
      }
      table.push_back(row);
    }

    for(int i=0;i<table.size();i++) {
      row_t& row = table[i];
      for(int j=0;j<row.size();j++) {
        EncodedTileMaker& tilemaker = row[j];
        // tile_threads.create_thread(boost::bind(&EncodedTileMaker::process,&tilemaker));
        thread_pool.AddJob(boost::bind(&EncodedTileMaker::process,&tilemaker));
      }
    }
    // tile_threads.join_all();
    thread_pool.JoinAll();
    std::cout << "Finished tile threads"<< std::endl;

    nlohmann::json jtiles;
    for(int i=0;i<table.size();i++) {
      row_t& row = table[i];
      nlohmann::json jrow;
      for(int j=0;j<row.size();j++) {
        EncodedTileMaker& tilemaker = row[j];
        jrow.push_back(tilemaker.json());
      }
      jtiles.push_back(jrow);      
    }
  
    r.emplace("wireimg_encoded_tiles",jtiles);
  
    timer_tiles.addto(r);    
  }


  // make stats.
  {
    TimeReporter timer_stats("time_to_make_histograms");
    TH1D timeProfile("timeProfile","timeProfile",ntdc/25,0,ntdc);
    std::vector<TH1*> planeProfile;
    std::vector<Double_t> timeProfileData(ntdc+2,0);
    planeProfile.push_back(new TH1D("planeProfile0","planeProfile0",2398/24,0,2398));
    planeProfile.push_back(new TH1D("planeProfile1","planeProfile1",2398/24,0,2398));
    planeProfile.push_back(new TH1D("planeProfile2","planeProfile2",3456/24,0,3456));
    // TH1D hPedAdc("hPedAdc","hPedAdc",8192,-4096,4096);
    // std::vector<size_t> hPedAdc(8192,0);
    // waveform_t blank(ntdc,0);
    for(int wire=0;wire<nwire;wire++) 
    {
      waveform_ptr_t wireptr = (*wireMap)[wire];
      waveform_ptr_t noiseptr = (*noiseWireMap)[wire];
      
      if(wireptr) {
        waveform_t& waveform = *(wireptr);
        double wiresum = 0;
            
        for(int k=0;k<ntdc;k++) {        
          short raw = waveform[k];
          if(noiseptr) raw -= (*noiseptr)[k];
          
          // assert(raw+4096>=0);
          // assert(raw+4096<8192);
          // hPedAdc->Fill(raw);
          // hPedAdc[raw+4096]++;
          double val = abs(raw);
          wiresum += val;
          timeProfileData[k] += val;
        }
        int plane, planewire;
        wireOfChannel(wire,plane,planewire);
        planeProfile[plane]->Fill(planewire,wiresum);
      }
    }
    // timeProfile.SetContent(&timeProfileData[0]);
    // timeProfile.Rebin(10);
    for(int i=0;i<ntdc;i++) { timeProfile.Fill(i,timeProfileData[i]); }
  
    r.emplace("timeHist",TH1ToHistogram(&timeProfile));
    nlohmann::json jPlaneHists;
    jPlaneHists.push_back(TH1ToHistogram(planeProfile[0]));
    jPlaneHists.push_back(TH1ToHistogram(planeProfile[1]));
    jPlaneHists.push_back(TH1ToHistogram(planeProfile[2]));
    r.emplace("planeHists",jPlaneHists);
    

    delete planeProfile[0];
    delete planeProfile[1];
    delete planeProfile[2];

    timer_stats.addto(r);
    
  }
  
  
}


// Notes: running full-speed on local:
// Compression 5 -> 10851 ms full pipeline.
// Compression 3 ->  9988 ms full pipeline.
// Running throttled to 30 MB/s (wifi)
// Compression 7 -> 28545
// Compression 5 -> 26262 25947 ms
// Compression 3 -> 27017 26998 ms
// Compression 1 -> 29908 ms



EncodedTileMaker::EncodedTileMaker( 
                  std::shared_ptr<wiremap_t> wireMap, 
                  std::shared_ptr<wiremap_t> noiseWireMap, 
                  int wireStart, int wireEnd, size_t tdcStart, size_t tdcEnd,
                  const std::string& outDir,
                  const std::string& outUrl,
                  bool fill_empty_space )
  : m_wireMap(wireMap) 
  , m_noiseWireMap(noiseWireMap)
  , m_wireStart(wireStart)
  , m_wireEnd(wireEnd)
  , m_tdcStart(tdcStart)
  , m_tdcEnd(tdcEnd)
  , m_outDir(outDir)
  , m_outUrl(outUrl)
  , m_fill_empty_space(fill_empty_space)  
{
  // // Pick an output filename
  // char* buffer = new char[m_outDir.length()+20];
  // std::string tmplate= m_outDir + "/XXXXXXXX";
  // strcpy(buffer,tmplate.c_str());
  // m_temp_pathname = std::string(buffer) + ".png.tmp";
  // m_final_pathname = std::string(buffer) + ".png";
  // m_filename = m_final_pathname.substr(m_outDir.length(),std::string::npos);
  // delete [] buffer;
}

int EncodedTileMaker::s_compression = 5;

void EncodedTileMaker::process() // Nice and wrapped up, ready to be called in a thread.
{
  int ntdc = (m_tdcEnd-m_tdcStart);
  MakePng m_png(ntdc,(m_wireEnd-m_wireStart),MakePng::rgb,s_compression);
  std::vector<unsigned char> encodeddata(ntdc*3);    // Three bytes per entry.

  waveform_t dummy(9600,0);

  const int zeroadc =  0x8080;

  for(int wire=m_wireStart;wire<m_wireEnd;wire++) 
  {
    // waveform_t& waveform = blank;
    waveform_ptr_t waveform_ptr; if(wire<m_wireMap->size())      waveform_ptr = (*m_wireMap)[wire];
    waveform_ptr_t noise_ptr;    if(wire<m_noiseWireMap->size()) noise_ptr    = (*m_noiseWireMap)[wire];

    if(waveform_ptr) {
      // We have a good wire recorded.0
      waveform_t& waveform = *(waveform_ptr);
      // uint8_t encoded_ped = (uint32_t)abs(waveform._pedwidth) & 0xF;
      // uint16_t blue_channel = encoded_ped + ( ((waveform._servicecard)&0xF) << 4 );
      
      waveform_t& noisewaveform = dummy;      
      if(noise_ptr) noisewaveform = *(noise_ptr);

      
      for(int k=0;k<ntdc;k++) {
        unsigned int isample = k+m_tdcStart;
        int iadc = waveform[isample] + zeroadc;
        // iadc = (k+m_tdcStart - 4800)/2 + 0x8000; // Testing only :generates a linear slope map
        // iadc = zeroadc + isample/10; // Testing only: Linear map, 10 pixels per value.
        encodeddata[k*3]   = 0xFF&(iadc>>8);  // high 8 bits (really 5)
        encodeddata[k*3+1] = iadc&0xFF;       // low 8 bits
        int inoise = noisewaveform[k+m_tdcStart];
        int outnoise = inoise + 0x80;
        if(outnoise <0) outnoise = 0;
        if(outnoise > 0xfe) outnoise = 0xfe;
        if(inoise == 0x7fff) outnoise = 0xff; // marker for dead ROI
        if(waveform._status >=0 && waveform._status<4) outnoise=0xff;
        encodeddata[k*3+2] = outnoise&0xff;
      }
    } else {
      // Do not have wire info.
      if(m_fill_empty_space) {        
        for(int k=0;k<ntdc;k++) {          
         encodeddata[k*3] = 0xFF&(zeroadc>>8); //
         encodeddata[k*3+1] = zeroadc&0xFF;; // Zero-adc wire. Not the same as blank.
         encodeddata[k*3+2] = 0; //
        }  
      } else {
        for(int k=0;k<ntdc;k++) {
          // Save bitpacked data as image map.
          encodeddata[k*3]   = 0;  //
          encodeddata[k*3+1] = 0;  // Blank! 
          encodeddata[k*3+2] = 0xff;  // bad
        }
      }
    }
    m_png.AddRow(encodeddata);      
  }
  m_png.Finish();
  
  m_filename = m_png.writeToUniqueFile(m_outDir);
  // // Write the file
  // m_png.writeToFile(m_temp_pathname);
  // // Atomic move.
  // rename(m_temp_pathname.c_str(),m_final_pathname.c_str());
  // std::cout << "Tile written to " << m_final_pathname << std::endl;
  std::cout << "Tile written to " << m_filename << std::endl;
  // Done!
}


