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
#include <iostream>
#include <fstream>
#include <sstream>
#include <vector>
#include <time.h>
#include <math.h>
#include <stdio.h>

#include "make_xml.h"
#include "XmlElement.h"
#include "LeafReader.h"

using namespace std;

// utility
std::string stringify_vector(const vector<int>& v)
{
  UInt_t n = v.size();
  std::string o;
  char b[10];
  for(UInt_t i=0;i<n;++i){
    if(i>0) o+=",";
    snprintf(b,10,"%d",v[i]);    
    o+=b;
  }
  return o;
}


void build_gate( XmlElement& xml,
                TTree*      inTree,
                Long64_t    inEntry,
                Int_t majorVer,
                Int_t revVer,
                Int_t patchVer,
                Int_t devVer)
{
  // A useful version ID
  UInt_t recoVer = majorVer*1000000 + revVer*1000 + patchVer*10 + devVer;
  // v8r1 is   8001000
  // v10r4 is 10004000 
  
  
  // Start building the output.
  xml << XmlElement("version", kVersion);
  xml << XmlElement("converter") << "build_xml.cpp $Revision$ $Date$ ";
  
  // inTree->SetBranchStatus("*",1);


  LeafReader lf(inTree);
  TObjArray* leafList = inTree->GetListOfLeaves();


  
  //
  // OK, now build the XML entry.
  //
  
  // Header data.
  XmlElement ev("ev");

  for(int i=0;i<leafList->GetEntriesFast();i++) {
    const char* n = leafList->At(i)->GetName();
    if(string(n).compare(0,3,"ev_",3)==0) {
      ev << lf.getXml(n+3, n);
    }
  }
  
  // ev << lf.getXml("detector"      , "ev_detector"      );
  // ev << lf.getXml("det_config"    , "ev_det_config"    );
  // ev << lf.getXml("run"           , "ev_run"           ); 
  // ev << lf.getXml("sub_run"       , "ev_sub_run"       ); 
  // ev << lf.getXml("trigger_type"  , "ev_trigger_type"  ); 
  // ev << lf.getXml("cal_settings"  , "ev_cal_settings"  ); 
  // ev << lf.getXml("gl_gate"       , "ev_gl_gate"       ); 
  // ev << lf.getXml("gate"          , "ev_gate"          ); 
  // ev << lf.getXml("gps_time_sec"  , "ev_gps_time_sec"  ); 
  // ev << lf.getXml("gps_time_usec" , "ev_gps_time_usec" ); 
  // //if MINERVA_VER < 700700000
  // ev << lf.getXml("readout"       , "ev_readout" );
  // //endif                           
  // ev << lf.getXml("errors"       , "ev_errors" );

  // convert times.
  struct tm tm_local;
  time_t tt= lf.getInt("ev_gps_time_sec");
  localtime_r(&tt,&tm_local);
  ev << XmlElement("local_gmt_offset",tm_local.tm_gmtoff);
  ev << XmlElement("local_timezone",tm_local.tm_zone);

  xml << ev;

  ///
  /// FEBs
  ///
  // You know, we don't use this and it's a terrible drain on resources.
  // XmlElement febs("febs");
  // febs.addAttr("n",n_febs);
  //  for(int i=0;i<n_febs;i++) {
  //    XmlElement feb("feb");
  //    feb.addAttr("index",i);
  //    feb << XmlElement("id"          , feb_id[i] );
  //        << XmlElement("hv_on"       , feb_hv_on[i] );
  //        << XmlElement("hv_targ"     , feb_hv_targ[i] );
  //        << XmlElement("hv_act"      , feb_hv_act[i] );
  //        << XmlElement("hv_per_man"  , feb_hv_per_man[i] );
  //        << XmlElement("hv_per_auto" , feb_hv_per_auto[i] );
  //    febs << feb;
  //  }
  //  xml << febs;
  
  ///
  /// Clusters
  ///
  
  // Build cluster lookup table.
  std::map<int, vector<int> > mapClusterToHits;
  std::map<int, vector<int> > mapHitToClusters;
  std::map<int, vector<int> > mapHitToTracks;
  std::map<int, vector<int> > mapHitToBlobs;
  
  std::string clus_prefix = "clus_id_";
  Int_t n_clusters = lf.getInt("n_clusters_id");
  if(recoVer < 8001000) {
    clus_prefix = "clus_";
    n_clusters = lf.getInt("n_clusters");
  }
  TLeaf* l_clus_strip     = inTree->GetLeaf((clus_prefix+"strip"     ).c_str());
  TLeaf* l_clus_module    = inTree->GetLeaf((clus_prefix+"module"    ).c_str());
  TLeaf* l_clus_plane     = inTree->GetLeaf((clus_prefix+"plane"     ).c_str());
  TLeaf* l_clus_coord     = inTree->GetLeaf((clus_prefix+"coord"     ).c_str());
  TLeaf* l_clus_coordErr  = inTree->GetLeaf((clus_prefix+"coordErr"  ).c_str());
  TLeaf* l_clus_width     = inTree->GetLeaf((clus_prefix+"width"     ).c_str());
  TLeaf* l_clus_z         = inTree->GetLeaf("clus_z"                );
  TLeaf* l_clus_view      = inTree->GetLeaf((clus_prefix+"view"      ).c_str());
  TLeaf* l_clus_pe        = inTree->GetLeaf((clus_prefix+"pe"        ).c_str());
  TLeaf* l_clus_energy    = inTree->GetLeaf((clus_prefix+"energy"    ).c_str());
  TLeaf* l_clus_time      = inTree->GetLeaf((clus_prefix+"time"      ).c_str());
  TLeaf* l_clus_time_slice= inTree->GetLeaf((clus_prefix+"time_slice").c_str());
  TLeaf* l_clus_size      = inTree->GetLeaf((clus_prefix+"size"      ).c_str());
  TLeaf* l_clus_type      = inTree->GetLeaf((clus_prefix+"type"      ).c_str());
  TLeaf* l_clus_flag      = inTree->GetLeaf((clus_prefix+"flag"      ).c_str());
  TLeaf* l_clus_usedFor   = inTree->GetLeaf((clus_prefix+"usedFor"   ).c_str());
  TLeaf* l_clus_lpos      = inTree->GetLeaf((clus_prefix+"lpos"      ).c_str());

  XmlElement clusters("clusters");
  clusters.addAttr("n",n_clusters); 
  for(int i=0;i<n_clusters;i++) {
    XmlElement clus("clus");
    Int_t index = lf.getInt(clus_prefix+"index",i);
    clus.addAttr("index",  index);
    clus.addAttr("strip"     , lf.getInt(l_clus_strip      , i) );
    clus.addAttr("module"    , lf.getInt(l_clus_module     , i) );
    clus.addAttr("plane"     , lf.getInt(l_clus_plane      , i) );
    clus.addAttr("coord"     , lf.getVal(l_clus_coord      , i) );
    clus.addAttr("coorderr"  , lf.getVal(l_clus_coordErr   , i) );
    clus.addAttr("width"     , lf.getVal(l_clus_width      , i) );
    clus.addAttr("z"         , lf.getVal(l_clus_z          , i) );
    clus.addAttr("view"      , lf.getInt(l_clus_view       , i) );
    clus.addAttr("pe"        , lf.getVal(l_clus_pe         , i) );
    clus.addAttr("energy"    , lf.getVal(l_clus_energy     , i) );
    clus.addAttr("time"      , lf.getVal(l_clus_time       , i) );
    clus.addAttr("slice"     , lf.getInt(l_clus_time_slice , i) );
    clus.addAttr("size"      , lf.getInt(l_clus_size       , i) );
    clus.addAttr("type"      , lf.getInt(l_clus_type       , i) );
    clus.addAttr("flag"      , lf.getInt(l_clus_flag       , i) );
    clus.addAttr("usedFor"   , lf.getInt(l_clus_usedFor    , i) );
    clus.addAttr("lpos"      , lf.getInt(l_clus_lpos       , i) );

    XmlElement hits_idx("hits_idx");
    Int_t clus_size = lf.getInt(clus_prefix+"size",i);
    for(int j=0;j<clus_size;j++) {
      if(j>0) hits_idx << ",";
      Int_t hit_id = lf.getInt(clus_prefix+"hits_idx",i,j);
      hits_idx << hit_id;
      mapHitToClusters[hit_id].push_back(index);
      mapClusterToHits[index].push_back(hit_id);
    }
    //clus << hits_idx;
    clus.addAttr("hits_idx",hits_idx.content());
  
    clusters << clus;
  }    
  xml << clusters;
  
  ///
  /// Tracks
  ///
  Int_t n_tracks = lf.getInt("n_tracks");
  std::vector<XmlElement> tracks(n_tracks,XmlElement("trk"));
  
  for(int i=0;i<n_tracks;i++) {
    XmlElement& trk = tracks[i];
    trk.addAttr("index",lf.getInt("trk_index",i));
    trk << lf.getXml("slice"           , "trk_time_slice"      , i )
        << lf.getXml("patrec"          , "trk_patrec"          , i )
        << lf.getXml("vis_energy"      , "trk_vis_energy"      , i )
        << lf.getXml("theta"           , "trk_theta"           , i );
    Double_t phi = lf.getVal("trk_phi",i);
    if(recoVer < 8001000 )  phi = M_PI/2. - phi;
    trk << XmlElement("phi",phi)
        << lf.getXml("hits"            , "trk_hits"            , i )
        << lf.getXml("dof"             , "trk_dof"             , i )
        << lf.getXml("chi2perDof"      , "trk_chi2perDof"      , i )
        //if MINERVA_VER < 700700000                            
        // << lf.getXml("minos_qual"      , "trk_minos_qual"      , i )
        // << lf.getXml("minos_mom"       , "trk_minos_mom"       , i )
        // << lf.getXml("minos_track_idx" , "trk_minos_trk_index" , i )
        //endif        
        << lf.getXml("flag"            , "trk_flag"            , i )
        << lf.getXml("usedFor"         , "trk_usedFor"         , i )
        
        ;

    //
    // Nodes.
    //
    XmlElement nodes("nodes");
    Int_t n_nodes = lf.getInt("trk_nodes",i);
    nodes.addAttr("n",n_nodes);  
    for(int j=0;j<n_nodes;j++) {
      XmlElement node("node");
      node.addAttr("index",j);
      node << lf.getXml("x"             , "trk_node_X"           , i , j )
           << lf.getXml("y"             , "trk_node_Y"           , i , j )
           << lf.getXml("z"             , "trk_node_Z"           , i , j )
           << lf.getXml("ax"            , "trk_node_aX"          , i , j )
           << lf.getXml("ay"            , "trk_node_aX"          , i , j )
           << lf.getXml("qp"            , "trk_node_qOverP"      , i , j )
           << lf.getXml("chi2"          , "trk_node_chi2"        , i , j );
      Int_t clus_idx =  lf.getInt("trk_node_cluster_idx" , i , j );
      node << XmlElement("cluster_index",clus_idx);
      nodes << node;
      
      vector<int>& clus = mapClusterToHits[clus_idx];
      for(UInt_t ihit=0;ihit<clus.size();ihit++) {
        mapHitToTracks[clus[ihit]].push_back(i);
      }
    }
    trk << nodes;

    // tracks.push_back(trk);
  }



  int n_matched_tracks = lf.getInt("n_prongs_MinosMatch");

  //if MINERVA_VER >= 700700000   // For earlier versions, this SHOULD fail gracefully.
  // Do explicit track matching. Loop through prongs to see where the match is.
  if(inTree->GetLeaf("n_prongs_MinosMatch")) {
    Int_t n_prongs_MinosMatch = lf.getInt("n_prongs_MinosMatch");
  
    for(int iprong = 0 ; iprong < n_prongs_MinosMatch; iprong++){
      // For each prong:
      Int_t n_trks = lf.getInt("prong_MinosMatch.n_trks",iprong);
      for(int iprongtrk = 0; iprongtrk < n_trks; iprongtrk++) {
        // For each minerva track listed in this prong
        int idx = lf.getInt("prong_MinosMatch.trk_idx",iprong,iprongtrk);
        if(idx>=0) {
          // OK, there's a match on the minerva side
          Int_t n_minos_trks = lf.getInt("prong_MinosMatch.n_minos_trks",iprong);
          for(int iminostrk=0 ;iminostrk <  n_minos_trks; iminostrk++) {
            // Add this index to the minerva track object.
            tracks[idx] << lf.getXml("minos_track_idx", "prong_MinosMatch.minos_trk_idx",iprong, iminostrk);
          }
        }
      }
    }
  } //endif
  
  // Do explcit track matching using >v9 ntuples.
  if(inTree->GetLeaf("minos_trk_minervatrk_idx")) {
    n_matched_tracks = 0;
    Int_t n_minos_trk = lf.getInt("n_minos_trk");
    for(int j=0;j<n_minos_trk;j++) {
      int minostrack = j;
      int minertrack = lf.getInt("minos_trk_minervatrk_idx",j);
      if(minertrack>=0 && minertrack< tracks.size()) {
        tracks[minertrack] << XmlElement("minos_track_idx", j); 
        n_matched_tracks++;
      }
    }
  } 
  
  
  

  XmlElement Tracks("tracks");
  Tracks.addAttr("n",n_tracks);
  Tracks.addAttr("n_minosMatch",n_matched_tracks);
  for(unsigned int i=0;i<tracks.size();i++) {Tracks << tracks[i];};
  xml << Tracks;
  
  
  ///
  /// ID Blobs
  ///
  XmlElement id_blobs("id_blobs");
  Int_t n_blobs_id = lf.getInt("n_blobs_id");
  id_blobs.addAttr("n",n_blobs_id);
  for(int i=0;i<n_blobs_id;i++) {
    XmlElement blob("blob");
    blob.addAttr("index",i);
    blob << lf.getXml("subdet",   "blob_id_subdet",    i);
    blob << lf.getXml("history",  "blob_id_history",   i);
    blob << lf.getXml("patrec",   "blob_id_patrec",   i);
    blob << lf.getXml("size",     "blob_id_size",      i);
    blob << lf.getXml("visible_e","blob_id_visible_e", i);
    blob << lf.getXml("e",        "blob_id_e",         i);
    blob << lf.getXml("time",     "blob_id_time",      i);
    blob << lf.getXml("slice",    "blob_id_time_slice",i);
    blob << lf.getXml("startpoint_x", "blob_id_startpoint_x",i);
    blob << lf.getXml("startpoint_y", "blob_id_startpoint_y",i);
    blob << lf.getXml("startpoint_z", "blob_id_startpoint_z",i);


    // clusters.
    XmlElement xclus_idx("clus_idx");
    XmlElement xhits_idx("hits_idx");
    TLeaf* lclusidx = inTree->GetLeaf("blob_id_clus_idx");
    int bnhits = 0;
    if(lclusidx) {
      Int_t n = lclusidx->GetLenStatic();
      for(int j=0;j<n;++j) {
        Int_t clus_idx = lf.getInt(lclusidx,i,j);
        if(clus_idx==-1) break;
        if(j>0) xclus_idx << ",";
        xclus_idx << clus_idx;
        
        // Reverse lookup table.
        vector<int>& clus = mapClusterToHits[clus_idx];
        for(UInt_t ihit=0;ihit<clus.size();ihit++) {
          mapHitToBlobs[clus[ihit]].push_back(i);
        }
        
        
        // Add hits of that cluster.
        Int_t clus_size = lf.getInt("clus_id_size",clus_idx);
        for(int k=0;k<clus_size;k++) {          
          if(bnhits++ >0) xhits_idx << ",";
          xhits_idx << lf.getInt("clus_id_hits_idx",clus_idx,k);
        }
        
      }
    }
    blob << xclus_idx;
    blob << xhits_idx;
    id_blobs << blob;
  } 
  xml << id_blobs;
  
  
  
  ///
  /// Vertices
  ///
  XmlElement vertices("vertices");
  Int_t n_vertices = lf.getInt("n_vertices");
  vertices.addAttr("n",n_vertices);
  for(int j=0;j<n_vertices;j++) {
    XmlElement vtx("vtx");
    vtx.addAttr("id",lf.getInt("vtx_index",j));
    vtx << lf.getXml("slice","vtx_time_slice"  , j );
    vtx << lf.getXml("x",    "vtx_x"           , j );
    vtx << lf.getXml("y",    "vtx_y"           , j );
    vtx << lf.getXml("z",    "vtx_z"           , j );
    vtx << lf.getXml("xerr", "vtx_x_err"       , j );
    vtx << lf.getXml("yerr", "vtx_y_err"       , j );
    vtx << lf.getXml("zerr", "vtx_z_err"       , j );
    vtx << lf.getXml("type", "vtx_type"        , j );
    vtx << lf.getXml("flag", "vtx_flag"        , j );
    Int_t n_trks_on_vertex = lf.getInt("vtx_n_tracks",j);
    for(int k=0;k<n_trks_on_vertex;k++)
      vtx << lf.getXml("track_idx","vtx_tracks_idx",j,k);
    vertices << vtx;
  }
  xml << vertices;
  
  
  
  ///
  /// Raw Hits
  ///
  // Maybe this goes inside rawhits block?
  xml << lf.getXml("n_idhits"  , "n_idhits"  );
  xml << lf.getXml("n_odhits"  , "n_odhits"  );
  xml << lf.getXml("n_vetohits"  , "n_vetohits"  );
  xml << lf.getXml("n_slices"  , "n_slices"  );
  xml << lf.getXml("hits_id_per_mod" , "hits_id_per_mod" );
  xml << lf.getXml("hits_od_per_mod" , "hits_od_per_mod" );
  xml << lf.getXml("hits_total_pe"   , "hits_total_pe"   );


  XmlElement rawhits("rawhits");
  rawhits.addAttr("n",       lf.getInt("n_rawhits"));
  rawhits.addAttr("n_idhits",lf.getInt("n_idhits"));
  rawhits.addAttr("n_odhits",lf.getInt("n_odhits"));
  rawhits.addAttr("n_slices",lf.getInt("n_slices"));

  XmlElement idhits("idhits");
  XmlElement odhits("odhits");
  XmlElement vetohits("vetohits");

  Int_t n_slices = lf.getInt("n_slices");

  std::vector<double> slice_t_start(n_slices+1,1e9);
  std::vector<double> slice_t_end  (n_slices+1,-1e9);
  std::vector<XmlElement> slices(n_slices+1,XmlElement("aslice"));
  std::vector<XmlElement> slices_idhits(n_slices+1,XmlElement("idhits"));
  std::vector<XmlElement> slices_odhits(n_slices+1,XmlElement("odhits"));
  std::vector<XmlElement> slices_vetohits(n_slices+1,XmlElement("vetohits"));

  // This is one of the most intensive bits, so let's actually do some caching.
  TLeaf* l_hit_channel_id  = inTree->GetLeaf("hit_channel_id");
  TLeaf* l_hit_disc_fired  = inTree->GetLeaf("hit_disc_fired");
  TLeaf* l_hit_pe          = inTree->GetLeaf("hit_pe"         );
  TLeaf* l_hit_norm_energy = inTree->GetLeaf("hit_norm_energy");
  TLeaf* l_hit_time        = inTree->GetLeaf("hit_time"       );
  TLeaf* l_hit_time_slice  = inTree->GetLeaf("hit_time_slice" );
  TLeaf* l_hit_flag        = inTree->GetLeaf("hit_flag"       );
  TLeaf* l_hit_strip       = inTree->GetLeaf("hit_strip"      );
  TLeaf* l_hit_plane       = inTree->GetLeaf("hit_plane"      );
  TLeaf* l_hit_module      = inTree->GetLeaf("hit_module"     );
  TLeaf* l_hit_view        = inTree->GetLeaf("hit_view"       );
  TLeaf* l_hit_bar         = inTree->GetLeaf("hit_bar"        );
  TLeaf* l_hit_story       = inTree->GetLeaf("hit_story"      );
  TLeaf* l_hit_tower       = inTree->GetLeaf("hit_tower"      );
  TLeaf* l_hit_frame       = inTree->GetLeaf("hit_frame"      );

  TLeaf* l_hit_wall        = inTree->GetLeaf("hit_wall"      );
  TLeaf* l_hit_paddle      = inTree->GetLeaf("hit_paddle"      );
  TLeaf* l_hit_pmt         = inTree->GetLeaf("hit_pmt"      );
  TLeaf* l_hit_user_color  = inTree->GetLeaf("hit_user_color" );
  if(!l_hit_user_color) cerr<< "Can't find hit_user_color leaf." << endl;;

  Int_t n_rawhits = lf.getInt("n_rawhits");
  for(int i=0;i<n_rawhits;i++) {
    XmlElement hit("rawhit");
    hit.addAttr("index",i);
 

    hit.addAttr("channel_id"      , lf.getStr( l_hit_channel_id     ,i));
    hit.addAttr("disc_fired"      , lf.getStr(l_hit_disc_fired   , i));
    hit.addAttr("pe"              , lf.getVal(l_hit_pe            ,i ));
    hit.addAttr("norm_energy"     , lf.getVal(l_hit_norm_energy   ,i ));
    hit.addAttr("time"            , lf.getVal(l_hit_time          ,i ) );

    int slice = lf.getInt(l_hit_time_slice    ,i );
    if(slice <0) slice = 0;
    hit.addAttr("slice"           , slice) ;

    int usercolor = lf.getInt(l_hit_user_color, i);
    if(usercolor>=0) {
      hit.addAttr("usercolor"       , Form("#%06x",(unsigned int)usercolor));
    }

    map<int,vector<int> >::iterator it;
    it = mapHitToTracks.find(i);
    if(it != mapHitToTracks.end()) {
      for(int mi=0;mi<it->second.size();mi++) {
        hit << XmlElement("track_id",it->second[mi]);
      }
    }
      
    it = mapHitToBlobs.find(i);
    if(it != mapHitToBlobs.end()) {
      for(int mi=0;mi<it->second.size();mi++) {
        hit << XmlElement("blob_id",it->second[mi]);
      }
    }
      
    // hit << XmlElement("track_id",stringify_vector(mapHitToTracks[i]));
    // hit << XmlElement("blob_id2",stringify_vector(mapHitToBlobs[i]));
    hit.addAttr("cluster_id",stringify_vector(mapHitToClusters[i]));

    hit.addAttr("flag",lf.getInt(l_hit_flag,i));
    
    bool is_idhit = (lf.getInt(l_hit_strip,i) >=0);
    bool is_odhit = (lf.getInt(l_hit_bar  ,i) >= 0);
    bool is_vetohit=(lf.getInt(l_hit_wall ,i) >= 0);
    if(is_idhit) {
      // ID hit.
      hit.addAttr("det","ID");
      hit.addAttr("strip"  ,lf.getInt( l_hit_strip  ,i  ));
      hit.addAttr("plane"  ,lf.getInt( l_hit_plane  ,i  ));
      hit.addAttr("module" ,lf.getInt( l_hit_module ,i  ));
      hit.addAttr("view"   ,lf.getInt( l_hit_view   ,i  ));          
    } 
    else if(is_odhit) {
      // OD hit.
      hit.addAttr("det","OD");
      // XmlElement address("ODAddress");
      hit.addAttr("bar"   , lf.getInt(l_hit_bar   , i ));
      hit.addAttr("story" , lf.getInt(l_hit_story , i ));
      hit.addAttr("tower" , lf.getInt(l_hit_tower , i ));
      hit.addAttr("frame" , lf.getInt(l_hit_frame , i ));          
	  }
	  else if(is_vetohit) {
  	  // Veto hit.
      // XmlElement address("VetoAddress");
	    hit.addAttr("det","Veto");
      hit.addAttr("wall"  , lf.getInt(l_hit_wall   ,i) );
		  hit.addAttr("paddle", lf.getInt(l_hit_paddle ,i) );
      hit.addAttr("pmt"   , lf.getInt(l_hit_pmt    ,i) );
		  //hit << address;
  } else {
 	      continue; // Ignore hits that aren't in the ID OR the OD.
  }
        
        
        Int_t sliceId = lf.getInt(l_hit_time_slice,i);
        if(sliceId > -1) {
          if(sliceId>slices.size()) {
            cerr << "n_slices is wrong! Found slice " << sliceId <<  " when n_slice is " << n_slices;
            xml << (XmlElement("warning") << "n_slices is wrong! Found slice " << sliceId <<  " when n_slice is " << n_slices);
          } else {
            if(is_idhit) slices_idhits[sliceId] << hit;
            else if(is_odhit) slices_odhits[sliceId] << hit;
	      		else if(is_vetohit) slices_vetohits[sliceId] << hit;
            else slices[sliceId] << hit; // Add to generic list.
            double t = lf.getInt(l_hit_time         ,i );
            if(t < slice_t_start[sliceId]) slice_t_start[sliceId] = t;
            if(t > slice_t_end  [sliceId]) slice_t_end  [sliceId] = t;
            
          }
        } else {
          if(is_idhit) idhits << hit;
          else if(is_odhit) odhits << hit;
		      else if(is_vetohit) vetohits << hit;
          else rawhits << hit; // Add to generic list.          
        }
   }

   rawhits << idhits;
   rawhits << odhits;
   rawhits << vetohits;
   xml << rawhits;
   
   XmlElement allslices("slices");
   for(UInt_t islice=0;islice<slices.size();islice++) {
     slices[islice].addAttr("sliceId",islice);
     slices[islice].addAttr("t_start",slice_t_start[islice]);
     slices[islice].addAttr("t_end",slice_t_end[islice]);
     slices[islice] << slices_idhits[islice];
     slices[islice] << slices_odhits[islice];
     slices[islice] << slices_vetohits[islice];
     allslices << slices[islice];
   }
   xml << allslices;

  
  
  
  
  
  
  ///
  /// Filters
  ///
  XmlElement allfilters("filters_by_slice");

  // Cleverness. Look through the list of leaves for things that match 'filt_'
  std::vector<const char*> filter_names;
  for(int i=0;i<leafList->GetEntriesFast();i++) {
    const char* n = leafList->At(i)->GetName();
    if(string(n).compare(0,5,"filt_",5)==0) {
      filter_names.push_back(n);
    }
  }


  for(int j=0;j<n_slices;j++) {
    XmlElement filt("filt");
    filt.addAttr("slice",j);

    // Create an XML element <NAME></NAME> from a tree leaf named filt_NAME.
    for(UInt_t i=0; i< filter_names.size(); i++) {
      filt << lf.getXml((filter_names[i])+5, filter_names[i], j);
    }
     allfilters << filt;
  }
  xml << allfilters;


  ///
  /// Minos Tracks
  ///
  XmlElement minos("minos");
  minos << lf.getXml("minos_run","minos_run");
  minos << lf.getXml("minos_subrun","minos_subrun");
  minos << lf.getXml("minos_snarl","minos_snarl");
  minos << lf.getXml("minos_sec","minos_sec");
  minos << lf.getXml("minos_nanosec","minos_nanosec");

  XmlElement minos_tracks("minos_tracks");
  Int_t n_minos_trk = lf.getInt("n_minos_trk");
  minos_tracks.addAttr("n",n_minos_trk);
  minos_tracks.addAttr("n_minosMatch",lf.getInt("n_prongs_MinosMatch"));
  for(int j=0;j<n_minos_trk;j++) {
    XmlElement trk("minos_trk");
    trk.addAttr("index",lf.getInt("minos_trk_idx",j ));
    trk << lf.getXml("index"     ,"minos_trk_idx"      , j );
    trk << lf.getXml("quality"   ,"minos_trk_quality"  , j );
    trk << lf.getXml("pass"      ,"minos_trk_pass"     , j );
    trk << lf.getXml("chi2"      ,"minos_trk_chi2"     , j );
    trk << lf.getXml("ndf"       ,"minos_trk_ndf"      , j );
    trk << lf.getXml("bave"      ,"minos_trk_bave"     , j );
    trk << lf.getXml("range"     ,"minos_trk_range"    , j );
    trk << lf.getXml("con"       ,"minos_trk_con"      , j );
    trk << lf.getXml("p"         ,"minos_trk_p"        , j );
    trk << lf.getXml("prange"    ,"minos_trk_prange"   , j );
    trk << lf.getXml("qp"        ,"minos_trk_qp"       , j );
    trk << lf.getXml("eqp"       ,"minos_trk_eqp"      , j );
    trk << lf.getXml("vtxp"      ,"minos_trk_vtxp"     , j );
    trk << lf.getXml("vtxu"      ,"minos_trk_vtxu"     , j );
    trk << lf.getXml("vtxv"      ,"minos_trk_vtxv"     , j );
    trk << lf.getXml("vtxx"      ,"minos_trk_vtxx"     , j );
    trk << lf.getXml("vtxy"      ,"minos_trk_vtxy"     , j );
    trk << lf.getXml("vtxz"      ,"minos_trk_vtxz"     , j );
    trk << lf.getXml("vtxt"      ,"minos_trk_vtxt"     , j );
    trk << lf.getXml("mvax"      ,"minos_trk_mvax"     , j );
    trk << lf.getXml("mvau"      ,"minos_trk_mvau"     , j );
    trk << lf.getXml("mvav"      ,"minos_trk_mvav"     , j );
    trk << lf.getXml("vtx_dxdz"  ,"minos_trk_vtx_dxdz" , j );
    trk << lf.getXml("vtx_dydz"  ,"minos_trk_vtx_dydz" , j );
    trk << lf.getXml("vtx_dudz"  ,"minos_trk_vtx_dudz" , j );
    trk << lf.getXml("vtx_dvdz"  ,"minos_trk_vtx_dvdz" , j );
    trk << lf.getXml("endp"      ,"minos_trk_endp"     , j );
    trk << lf.getXml("endu"      ,"minos_trk_endu"     , j );
    trk << lf.getXml("endv"      ,"minos_trk_endv"     , j );
    trk << lf.getXml("endx"      ,"minos_trk_endx"     , j );
    trk << lf.getXml("endy"      ,"minos_trk_endy"     , j );
    trk << lf.getXml("endz"      ,"minos_trk_endz"     , j );
    trk << lf.getXml("endt"      ,"minos_trk_endt"     , j );
    trk << lf.getXml("ns"        ,"minos_trk_ns"       , j );
    trk << lf.getXml("minerva_index","minos_minerva_trk_idx" ,j )
        ;

    // estimate the slice.
    double t = 0.5*(lf.getVal("minos_trk_vtxt", j ) + lf.getVal("minos_trk_endt" , j ));
    int slice = -1;
    for(UInt_t islice=0;islice<slices.size();islice++) {
      if((t >= slice_t_start[islice]) && ( t <= slice_t_end[islice] )) slice=islice;
    }
    trk << XmlElement("slice",slice);    

    XmlElement trkstrips("trk_strips");
    // How deep should I look?
    TLeaf* zleaf = inTree->GetLeaf("minos_trk_stp_z");
    if(zleaf) {
      Int_t max_stps = zleaf->GetLenStatic();
      
      Double_t endz = lf.getVal("minos_trk_endz",j);
      
      int trknstrips = lf.getInt("minos_trk_ns",j);
      if(trknstrips > max_stps) trknstrips = max_stps;
      // Need to sort the strips.
      std::multimap<double,XmlElement> stpByZ;
      std::multimap<double,XmlElement>::iterator stpit;
      for(int istp=0;istp<trknstrips;istp++) {
        Double_t z = lf.getVal("minos_trk_stp_z",j,istp);
        // if(z<=0) continue;
        // if(z>=endz) continue;
        XmlElement trkstrip("trk_strip");
        trkstrip << lf.getXml("x"    ,"minos_trk_stp_x",j,istp)
                 << lf.getXml("y"    ,"minos_trk_stp_y",j,istp)
                 << lf.getXml("z"    ,"minos_trk_stp_z",j,istp)
                 << lf.getXml("t"    ,"minos_trk_stp_t",j,istp)
                 // << lf.getXml("meu"  ,"minos_trk_stp_meu" ,j,istp)
                 // << lf.getXml("fit"  ,"minos_trk_stp_fit" ,j,istp)
                 << lf.getXml("u"    ,"minos_trk_stp_u"   ,j,istp)
                 << lf.getXml("v"    ,"minos_trk_stp_v"   ,j,istp)
                 ;                                         
         stpByZ.insert(pair<double,XmlElement>(z,trkstrip));
        }
        for(stpit = stpByZ.begin(); stpit != stpByZ.end(); stpit++) {
          trkstrips << stpit->second;          
        }
        
        trk << trkstrips;
      }
    
    minos_tracks << trk;    
  }
  minos << minos_tracks;
  
  ///
  /// Minos Strips
  ///
  XmlElement minos_strips("minos_strips");
  Int_t n_minos_stp = lf.getInt("n_minos_stp");
  for(int j=0;j<n_minos_stp;j++) {
    XmlElement stp("stp");
    stp.addAttr("index",j);
    stp << lf.getXml("plane"     ,"minos_stp_plane"      , j );
    stp << lf.getXml("strip"     ,"minos_stp_strip"      , j );
    stp << lf.getXml("view"      ,"minos_stp_view"       , j );
    stp << lf.getXml("tpos"      ,"minos_stp_tpos"       , j );
    stp << lf.getXml("time"      ,"minos_stp_time"       , j );
    stp << lf.getXml("ph"        ,"minos_stp_ph"         , j );
    stp << lf.getXml("trkidx"    ,"minos_stp_trkidx"       , j );
    
    // Take an educated guess at which time slice this should be stuck into.
    double t = lf.getVal("minos_stp_time"       , j);
    int slice = -1;
    for(UInt_t islice=0;islice<slices.size();islice++) {
      if((t >= slice_t_start[islice]) && ( t <= slice_t_end[islice] )) slice=islice;
    }
    stp << XmlElement("slice",slice);
    minos_strips << stp;
  }
  if(n_minos_stp>0) minos << minos_strips;
  xml << minos;
  

  


  ///
  /// Beam
  ///
  XmlElement beam("beam");
  bool doBeam = false;
  for(int i=0;i<leafList->GetEntriesFast();i++) {
    const char* n = leafList->At(i)->GetName();
    if(string(n).compare(0,5,"beam_",5)==0) {
      beam << lf.getXml(n+5, n);
      // cout << "Beam entry: " << n << endl;
      doBeam = true;
    }
  }
  if(doBeam) xml << beam;


  ///
  /// Monte Carlo Truth Info
  ///
  // See if the basic MC truth structure is there. If so, let's append MC data to the XML.
  if(inTree->GetLeaf("n_interactions"))
  {
    XmlElement mc("mc");

    XmlElement interactions("interactions");
    Int_t n_interactions = lf.getInt("n_interactions");
    interactions.addAttr("n",n_interactions);
    for(int i=0;i<n_interactions;i++) {
      // Convert units for older versions of reco code.
      UInt_t recoVer = majorVer*1000000 + revVer*1000 + patchVer*10 + devVer;
      // v8r1 is 8001000
      double unit_conv = 1.0;
      if(recoVer < 10001010) {
        unit_conv = 1000;
      }
      
      XmlElement interaction("interaction");  interaction.addAttr("index",i);
      interaction << lf.getXml("processType",    "mc_int_processType"  , i );
      interaction << lf.getXml("nevSpill",       "mc_int_nevSpill"     , i );
      interaction << lf.getXml("nevFile",        "mc_int_nevFile"      , i );
      interaction << lf.getXml("channel",        "mc_int_channel"      , i );
      interaction << lf.getXml("current",        "mc_int_current"      , i );
      interaction << lf.getXml("charm",          "mc_int_charm"        , i );
      interaction << lf.getXml("weight",         "mc_int_weight"       , i );
      interaction << lf.getXml("xSection",       "mc_int_xSection"     , i );
      interaction << lf.getXml("incomingPDG",    "mc_int_incomingPDG"  , i );
      interaction << lf.getXml("tgtNucleus",     "mc_int_tgtNucleus"   , i );
      interaction << lf.getXml("tgtNucleon",     "mc_int_tgtNucleon"   , i );
      interaction << lf.getXml("targetZ",        "mc_int_targetZ"      , i );
      interaction << lf.getXml("targetA",        "mc_int_targetA"      , i );
      interaction << lf.getXml("hitQuark",       "mc_int_hitQuark"     , i );
      interaction << lf.getXml("seaQuark",       "mc_int_seaQuark"     , i );
      interaction << lf.getXml("resID",          "mc_int_resID"        , i );
      interaction << lf.getXml("FSLepton",       "mc_int_FSLepton"     , i );
      // Convert to MeV if required.
      double incomingE = lf.getVal("mc_int_incomingE",i);
      double QSquared  = lf.getVal("mc_int_QSquared",i);
      double W         = lf.getVal("mc_int_W",i);
      interaction << XmlElement("incomingE",incomingE*unit_conv);
      interaction << XmlElement("QSquared",QSquared*unit_conv);
      interaction << XmlElement("W",W*unit_conv);
      
      interaction << lf.getXml("incomingE",      "mc_int_incomingE"    , i );
      interaction << lf.getXml("QSquared",       "mc_int_QSquared"     , i );
      interaction << lf.getXml("W",                   "mc_int_W", i);

      interaction << lf.getXml("bjorkenX",       "mc_int_bjorkenX"     , i );
      interaction << lf.getXml("bjorkenY",       "mc_int_bjorkenY"     , i );
      interaction << lf.getXml("nucleonT",       "mc_int_nucleonT"     , i );
      interaction << lf.getXmlArray("vtx",            "mc_int_vtx"          , i );
      interaction << lf.getXmlArray("incoming4p",     "mc_int_incoming4p"   , i);
      interaction << lf.getXmlArray("incoming4p",     "mc_int_incoming4P"   , i);
      interaction << lf.getXmlArray("tgtNucleon4p",   "mc_int_tgtNucleon4p" , i);
      interaction << lf.getXmlArray("FSLepton4p",     "mc_int_FSLepton4p"   , i);
      // Final state particles.
      
      XmlElement FSParticles("FSParticles"); 
      Int_t nFS = lf.getInt("mc_int_nFSParticles",i);
      FSParticles.addAttr("n",nFS);
      for(int j=0;j<nFS;j++) {
        XmlElement part("FSParticle"); part.addAttr("index",j);        
        part << lf.getXml("Pdg", "mc_int_FSPdg"          ,i,j);
        part << lf.getXml("Px",  "mc_int_FSParticlesPx"  ,i,j);
        part << lf.getXml("Py",  "mc_int_FSParticlesPy"  ,i,j);
        part << lf.getXml("Pz",  "mc_int_FSParticlesPz"  ,i,j);
        part << lf.getXml("E",   "mc_int_FSParticlesE"   ,i,j);

        FSParticles << part;
      } // loop over final state 
      interaction << FSParticles;
      
      interactions << interaction;
    }
    mc << interactions;
    
    
    Int_t n_mc_particles = lf.getInt("n_mc_particles");
    XmlElement particles("particles"); particles.addAttr("n",n_mc_particles);
    for(int i=0;i<n_mc_particles;i++) {
      XmlElement particle("particle"); particle.addAttr("index",lf.getInt("mc_part_index",i));
      particle << lf.getXml("pid"     , "mc_part_pid"    ,i );
      particle << lf.getXml("type"    , "mc_part_type"   ,i );
      particle << lf.getXml("mother"  , "mc_part_mother" ,i );
      particle << lf.getXml("mpid"    , "mc_part_mpid"   ,i );
      particle << lf.getXml("x"       , "mc_part_x"      ,i );
      particle << lf.getXml("y"       , "mc_part_y"      ,i );
      particle << lf.getXml("z"       , "mc_part_z"      ,i );
      particle << lf.getXml("t"       , "mc_part_t"      ,i );
      particle << lf.getXml("px"      , "mc_part_px"     ,i );
      particle << lf.getXml("py"      , "mc_part_py"     ,i );
      particle << lf.getXml("pz"      , "mc_part_pz"     ,i );
      particle << lf.getXml("E"       , "mc_part_E"      ,i );
      particle << lf.getXml("p"       , "mc_part_p"      ,i );
      
      particles<<particle;
    }
    mc << particles;

    // MC trajectory information.
    Int_t n_mc_trajectories = lf.getInt("n_mc_trajectories");
    // Earlier versions of the code badly coded this value. Leads to nasty buffer over-runs.
    if((recoVer < 10004000) && (lf.getInt("m_mc_traj_overflow") > 0)) n_mc_trajectories = 500;
    if((recoVer < 10004000) && (n_mc_trajectories > 500)) n_mc_trajectories = 500;
    XmlElement trajectories("trajectories"); trajectories.addAttr("n",n_mc_trajectories);
    for(int i=0; i< n_mc_trajectories; i++) {
      XmlElement traj("traj");
      traj.addAttr("strlength"  , lf.getVal("mc_traj_strlength",i));
      traj.addAttr("curvlength" , lf.getVal("mc_traj_curvlength",i));
      traj.addAttr("leaving"    , lf.getInt("mc_traj_leaving",i));
      traj.addAttr("trkid"      , lf.getInt("mc_traj_trkid",i));
      traj.addAttr("parentid"   , lf.getInt("mc_traj_parentid",i));
      traj.addAttr("pdg"        , lf.getInt("mc_traj_pdg",i));
      traj.addAttr("hit_e"      , lf.getVal("mc_traj_hit_e",i));
      Int_t npoints =  lf.getInt("mc_traj_npoints",i);
      traj.addAttr("npoints"    , npoints);
      for(int j=0;j<npoints;j++) {
        XmlElement trajpoint("trajpoint");
        trajpoint.addAttr("i"    , j);
        trajpoint.addAttr("x"    , lf.getVal("mc_traj_point_x",i,j));
        trajpoint.addAttr("y"    , lf.getVal("mc_traj_point_y",i,j));
        trajpoint.addAttr("z"    , lf.getVal("mc_traj_point_z",i,j));
        trajpoint.addAttr("t"    , lf.getVal("mc_traj_point_t",i,j));
        trajpoint.addAttr("px"   , lf.getVal("mc_traj_point_px",i,j));
        trajpoint.addAttr("py"   , lf.getVal("mc_traj_point_py",i,j));
        trajpoint.addAttr("pz"   , lf.getVal("mc_traj_point_pz",i,j));
        trajpoint.addAttr("E"    , lf.getVal("mc_traj_point_E",i,j));
        traj << trajpoint;
      }
      trajectories << traj;
    }
    mc << trajectories;

    // I don't really use this yet, so let's take it out: too big!
    /*
    XmlElement digits("digits"); 
    Int_t n_mc_id_digits = lf.getInt("n_mc_id_digits");
    Int_t n_mc_od_digits = lf.getInt("n_mc_od_digits");
    digits.addAttr("n",n_mc_id_digits + n_mc_od_digits);
    digits.addAttr("n_id",n_mc_id_digits);
    digits.addAttr("n_od",n_mc_od_digits);
    for(int i=0;i<n_mc_id_digits;i++) {
      XmlElement digit("digit");
      XmlElement add("IDAddress");
      add << lf.getXml("strip", "mc_id_strip" , i);
      add << lf.getXml("plane", "mc_id_plane" , i);
      add << lf.getXml("module","mc_id_module", i);
      add << lf.getXml("view",  "mc_id_view"  , i);
      digit<< add;

      digit << lf.getXml("pe"        ,"mc_id_pe"      , i);
      digit << lf.getXml("time"      ,"mc_id_time"    , i);
      digit << lf.getXml("npart"     ,"mc_id_npart"   , i);
      digit << lf.getXml("particle"  ,"mc_id_particle", i);
      digit << lf.getXml("pid"       ,"mc_id_pid"     , i);
      digit << lf.getXml("part_x"    ,"mc_id_part_x"  , i);
      digit << lf.getXml("part_y"    ,"mc_id_part_y"  , i);
      digit << lf.getXml("part_z"    ,"mc_id_part_z"  , i);
      digit << lf.getXml("part_t"    ,"mc_id_part_t"  , i);
      digit << lf.getXml("part_p"    ,"mc_id_part_p"  , i);
            
      digits << digit;
    }
    for(int i=0;i<n_mc_od_digits;i++) {
      XmlElement digit("digit");
      XmlElement add("ODAddress");
      add << lf.getXml("frame", "mc_od_frame" , i);
      add << lf.getXml("tower", "mc_od_tower" , i);
      add << lf.getXml("story", "mc_od_story" , i);
      add << lf.getXml("bar"  , "mc_od_bar"   , i);
      digit<< add;

      digit << lf.getXml("pe"        ,"mc_od_pe"        ,i );
      digit << lf.getXml("time"      ,"mc_od_time"      ,i );
      digit << lf.getXml("npart"     ,"mc_od_npart"     ,i );
      digit << lf.getXml("particle"  ,"mc_od_particle"  ,i );
      digit << lf.getXml("pid"       ,"mc_od_pid"       ,i );
      digit << lf.getXml("part_x"    ,"mc_od_part_x"    ,i );
      digit << lf.getXml("part_y"    ,"mc_od_part_y"    ,i );
      digit << lf.getXml("part_z"    ,"mc_od_part_z"    ,i );
      digit << lf.getXml("part_t"    ,"mc_od_part_t"    ,i );
      digit << lf.getXml("part_p"    ,"mc_od_part_p"    ,i );
            
      digits << digit;    
    }
    mc << digits;
    */
    xml << mc;
  }

  //
  // Test beam
  //
  XmlElement mtest("mtest");
  bool doMtest = false;
  for(int i=0;i<leafList->GetEntriesFast();i++) {
    const char* n = leafList->At(i)->GetName();
    if(string(n).compare(0,6,"mtest_",6)==0) {
      mtest << lf.getXml(n+6, n);
      doMtest = true;
    }
  }
  if(doMtest) xml << mtest;
  

}

