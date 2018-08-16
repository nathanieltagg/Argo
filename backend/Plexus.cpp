#include "Plexus.h"
#include "Logging.h"
#include "FormString.h"
#include <sstream>
#include <vector>
#include <algorithm>  
#include <cstring>

// Database interfaces:
#include <sqlite3.h> 
#include "libpq-fe.h"

namespace gov
{
namespace fnal
{
namespace uboone
{
namespace online
{
using std::string;

Plexus::Plek::Plek()
  : _crate (-1)  
  , _card (-1)
  , _channel (-1)
  , _view ('-')
  , _plane (-1)
  , _planewire (-1)
  , _wirenum (-1)
  , _asic_id (-1)
  , _servicecard_id(-1)
  , _type('?')
  , _pmt(-1)
  , _gain(-1)
{
}

std::string Plexus::Plek::to_string() const
{
  std::ostringstream o;
  if(_crate  >-1) o << "crate:" << _crate;
  if(_card   >-1) o << "|card:" << _card;
  if(_channel>-1) o << "|channel:" << _channel;
  if(_plane !='-')      o << " view:" << _view;
  if(_planewire>-1)     o << " planewire:" << _planewire;
  if(_wirenum>-1)       o << " wirenum:" << _wirenum;
  if(_asic_id>-1)       o << " asic: " << _asic_id;
  if(_servicecard_id>-1)       o << " servicecard: " << _servicecard_id;
  if(_type!='?')        o << " type:" << _type;
  if(_pmt>-1)           o << " pmt:" << _pmt;
  if(_gain>-1)          o << " gain:" << _gain;
  if(_stream.length()>0) o << " stream:" << _stream;
  std::string str = o.str();
  if(str.length()==0) str = "(Null)";
  return str;
}

std::string Plexus::Plek::to_json() const
{
  std::ostringstream o;
  o << "{ \"crate\":" << _crate;
  o << ", \"card\":" << _card;
  o << ", \"channel\":" << _channel;
  o << ", \"isWire\":" << (isWire()?"true":"false");
  o << ", \"isPmt\":" << (isPmt()?"true":"false");
  if(isWire()) {
    o << ", \"plane\":" << _plane;
    o << ", \"view\":\"" << _view << "\"";
    o << ", \"planewire\":" << _planewire;
    o << ", \"wirenum\":" << _wirenum;    
  } 
  if(isPmt()) {
    o << ", \"pmt\":" << _pmt;
    o << ", \"type\":\"" << _type << "\"";
    o << ", \"gain\":\"" << std::string(1,_gain) << "\"";
    o << ", \"planewire\":" << _planewire;
    o << ", \"stream\":" << _stream;
  } 
  for(auto it = _info.begin(); it!=_info.end(); it++) {
    o << ", \"" << it->first << "\":\"" << it->second << "\"";
  }
  
  o << "}";
  return o.str();
}


Plexus::Plexus()
 : m_ok(false)
 , m_validity_start(-1)
 , m_validity_end(-1)
 , m_nullplek()
{}
  
Plexus::~Plexus()
{}
  

void Plexus::assignSources(
    const std::string& tpc_source,  
    const std::string& pmt_source,  
    const std::string& tpc_source_fallback,    
    const std::string& pmt_source_fallback)
{
  m_tpc_source          = tpc_source;  
  m_pmt_source          = pmt_source;
  m_tpc_source_fallback = tpc_source_fallback;
  m_pmt_source_fallback = pmt_source_fallback;
}


bool Plexus::rebuild(double event_time, double query_time)
{
  bool need_rebuild = false;
  if(!m_ok) need_rebuild = true;
  if(event_time > m_validity_end) need_rebuild = true;
  if(event_time < m_validity_start) need_rebuild = true;
  
  if(need_rebuild) {
    m_ccc_to_plek.clear();
    
    // Build from source.  fall back to 'fallback' source, or fall back to hardcoded if that fails.
    bool tpc_ok =      buildTpc(event_time,query_time,m_tpc_source)
                    || buildTpc(event_time,query_time,m_tpc_source_fallback)
                    || buildTpcHardcoded(event_time);
    
    bool pmt_ok =      buildPmt(event_time,query_time,m_pmt_source)
                    || buildPmt(event_time,query_time,m_pmt_source_fallback)
                    || buildPmtHardcoded(event_time);
    
    m_ok = tpc_ok && pmt_ok; 
  }
  return m_ok;
}

bool Plexus::buildTpc(double event_time, double query_time, const std::string& source)
{
  // Interpret source string
  // Is it an sqlite or postgres?
  logInfo << "Plexus::buildTpc  " << source;
  
  if(source.length()==0) return false;
  if(source.find("postgres")==0) return buildTpcPostgres(event_time,query_time,source);
  if(source.find("sqlite")  ==0) return buildTpcSqlite(event_time,query_time,source);
  
  logWarn << "Plexus::buildTpc Could not figure out connection string " << source;
  return false;
}



bool Plexus::buildTpcPostgres (double event_time, double query_time,const std::string& source)
{
  std::string connection = source.substr(std::string("postgres ").length()); // Remove leading 'postgres ' statement.
  
  PGconn *conn = PQconnectdb(connection.c_str());
  if(PQstatus(conn)!=CONNECTION_OK) {
    logError << "Couldn't open connection to postgresql interface at " << source;
    logError << PQerrorMessage(conn);
    PQfinish(conn);
    return false;
  }

  // Validity Query.
  std::string vld_query; 
  vld_query =  "SELECT version_set, EXTRACT(EPOCH FROM begin_validity_timestamp) as vld_start, EXTRACT(EPOCH FROM end_validity_timestamp) as vld_end, EXTRACT(EPOCH FROM history_version_born_on) as insertdate  FROM HootVersion ";
  vld_query += " WHERE begin_validity_timestamp <= to_timestamp(" + std::to_string(event_time) + ")";
  vld_query += " AND end_validity_timestamp > to_timestamp(" + std::to_string(event_time) + ")";
  if(query_time>0) 
    vld_query += " AND EXTRACT(EPOCH FROM history_version_born_on) < " + std::to_string(query_time);
  vld_query +=" ORDER BY history_version_born_on desc limit 1;";
  logWarn << "Validity query:" << vld_query;

  PGresult *res  = PQexec(conn, vld_query.c_str());
  // if (PQresultStatus(res) != PGRES_COMMAND_OK) {
  //     logWarn << "Plexus::buildTpcPostgres postgresql validity query failed";
  //     PQclear(res);
  //     PQfinish(conn);
  //     return false;
  // }
  if (PQresultStatus(res) != PGRES_TUPLES_OK) {
    logError << "Plexus::buildTpcPostgres validity query did not return tuples properly";
    PQclear(res);
    PQfinish(conn);
    return false;
  }
  std::string version_set = PQgetvalue(res, 0, 0);
  m_validity_start = std::stod(PQgetvalue(res, 0, 1));
  m_validity_end   = std::stod(PQgetvalue(res, 0, 2));
  if(m_validity_end == 0) m_validity_end = 1e18; // Infinity.
  PQclear(res);
  

  res  = PQexec(conn, "BEGIN");
  if (PQresultStatus(res) != PGRES_COMMAND_OK) { 
      logError << "postgresql BEGIN failed";
       PQclear(res);
       PQfinish(conn);
       return false;
  }
  PQclear(res);
 
 // Possible columns:
 //  fem_slot_ranges_vers | slot  | physical_slot | slot_range | physical_slot_range | crate_id | fem_crate_ranges_vers | crate_range | fem_map_ranges_vers |   fem_map_range    | fem_mapping_vers | adcreceiver_topbot | mboardoutputconnector_pinpair | motherboard_mapping_vers | asic_chan | mboard_asicposn | orientation | mboardoutputconnector | crates_vers | adcreceiver_id | fecards_vers | adcreceivers_vers | feedthru | warmcables_vers | faraday_cage_connector | intermediateamplifiers_vers | signal_feedthru_connector | mboard_id | coldcables_vers | servicecards_vers | service_feedthru_connector | servicecables_vers | servicecable_id | motherboards_vers | asics_vers | asic_id | channels_vers |  history_version_born_on   | begin_validity_timestamp | end_validity_timestamp |                                         comment                                          | version_set | channel_id | wireplane | wirenum | larsoft_wirenum | larsoft_channel | asic_sn | motherboard_sn |    side    | servicecable_sn | servicecard_id | servicecard_sn | coldcable_id | coldcable_sn | intermediateamplifier_id | intermediateamplifier_sn | warmcable_id | warmcable_sn | adcreceiver_sn | daq_slot | fecard_id | fecard_sn | rack | rack_posn | mboard_channel_id | mboardinputconnector | mboardinputconnector_pin | fem_channel 
  
  std::string select_cmd = 
   " SELECT *"
   " FROM HootVersion"
   " NATURAL JOIN versioned_channels"
   " NATURAL JOIN versioned_asics"
   " NATURAL JOIN versioned_motherboards"
   " NATURAL JOIN versioned_servicecables"
   " NATURAL JOIN versioned_servicecards"
   " NATURAL JOIN versioned_coldcables"
   " NATURAL JOIN versioned_intermediateamplifiers"
   " NATURAL JOIN versioned_warmcables"
   " NATURAL JOIN versioned_adcreceivers"
   " NATURAL JOIN versioned_fecards"
   " NATURAL JOIN versioned_crates"
   " NATURAL JOIN versioned_motherboard_mapping"
   " NATURAL JOIN versioned_fem_mapping"
   " NATURAL JOIN versioned_fem_map_ranges"
   " NATURAL JOIN versioned_fem_crate_ranges"
   " NATURAL JOIN versioned_fem_slot_ranges"
   " WHERE version_set = '"
     + version_set
       + "';";

  logInfo << "Query: " << select_cmd;
  res = PQexec(conn, select_cmd.c_str());
  if ((!res) || (PQresultStatus(res) != PGRES_TUPLES_OK))
  {
      logError << "SELECT command did not return tuples properly";
      PQclear(res);
      PQfinish(conn);
      return false;;
  }
  
   int col_crate    = PQfnumber(res,"crate_id");
  int col_card     = PQfnumber(res,"daq_slot");
  int col_channel  = PQfnumber(res,"fem_channel");
  int col_larsoft  = PQfnumber(res,"larsoft_channel");
  int col_wireplane   = PQfnumber(res,"wireplane");
  int col_asic_id   = PQfnumber(res,"asic_id");
  int col_servicecard_id   = PQfnumber(res,"servicecard_id");
  
  
  int num_records = PQntuples(res);
  logInfo << " Got " << num_records << " records from postgresql";
  int columns = PQnfields(res);
  for(int i=0;i<num_records;i++) {
    Plek p;

    // p._crate = atoi(PQgetvalue(res, i, col_crate));
    // p._card  = atoi(PQgetvalue(res, i, col_card));
    // p._channel= atoi(PQgetvalue(res, i, col_channel));
    // p._wirenum= atoi(PQgetvalue(res, i, col_larsoft));
    // p._plane  = atoi(PQgetvalue(res, i, col_wireplane));
    //
    for(int j=0;j<columns;j++) {
        if(j==col_crate)  p._crate   = atoi(PQgetvalue(res, i, j));   
        else if(j==col_card     ) p._card    = atoi(PQgetvalue(res, i, j)); 
        else if(j==col_channel  ) p._channel = atoi(PQgetvalue(res, i, j)); 
        else if(j==col_larsoft  ) p._wirenum = atoi(PQgetvalue(res, i, j)); 
        else if(j==col_wireplane) p._view    = PQgetvalue(res, i, j)[0]; 
        else if(j==col_asic_id  ) p._asic_id  = atoi(PQgetvalue(res, i, j)); 
        else if(j==col_servicecard_id  ) p._servicecard_id  = atoi(PQgetvalue(res, i, j)); 
        else 
          p._info[PQfname(res,j)]=PQgetvalue(res,i,j);
    }
    
    
    fixPlek(p);
    insert(p);    
  }
  logInfo << "Loaded " << num_records << " TPC pleks from " << source;
  
  PQclear(res);
  PQfinish(conn);

  return true;
}



bool Plexus::buildTpcSqlite(double event_time, double query_time,const std::string& source)
{
  std::string file = source.substr(std::string("sqlite ").length()); // Remove leading 'postgres ' statement.

  sqlite3* db;
  sqlite3_stmt *statement;
  const char *dummy;
  int rc;
  
  /// TPC connections database
  
  rc = sqlite3_open(file.c_str(), &db);
  if( rc ){
    logWarn << "Could not open sqlite file " << file;
    sqlite3_close(db);
    return false;
  }
 
  // Validity Query.
  std::string vld_query; 
  vld_query =  "SELECT version_set, strftime('%s',begin_validity_timestamp)  as vld_start, ";
  vld_query +=  "strftime('%s',end_validity_timestamp)  as vld_end, ";
  vld_query +=  "strftime('%s',history_version_born_on) as insertdate ";
  vld_query +=  "FROM HootVersion ";
  vld_query += " WHERE begin_validity_timestamp <= datetime(" + std::to_string(event_time) + ",'unixepoch')";
  vld_query += " AND end_validity_timestamp > datetime(" + std::to_string(event_time) +",'unixepoch')";
  if(query_time>0) 
    vld_query += " AND history_version_born_on < datetime(" + std::to_string(query_time) + ",'unixepoch')";
  vld_query +=" ORDER BY history_version_born_on desc limit 1;";
  logWarn << "Validity query:" << vld_query;
 
  rc = sqlite3_prepare_v2(db, vld_query.c_str(), -1, &statement, &dummy);
    if( rc ){
    logWarn << "Could not prepare vld statement on sqlite file " << file << " error: " << sqlite3_errmsg(db);
    sqlite3_finalize(statement);
    sqlite3_close(db);
    return false;
  }
  
  rc = sqlite3_step(statement);
  if(rc != SQLITE_ROW) {
    logWarn << "No validity rows returned on file " << file ;
    sqlite3_finalize(statement);
    sqlite3_close(db);
    return false;
  }
  std::string version_set = (const char*) sqlite3_column_text(statement,0);
  m_validity_start = sqlite3_column_double(statement,1);
  m_validity_end   = sqlite3_column_double(statement,2);
  if(m_validity_end == 0) m_validity_end = 1e18; // Infinity.
  
  
  logInfo << "Found version_set " << version_set;
  sqlite3_finalize(statement);


  std::string select_cmd = 
   " SELECT *"
   " FROM ((((((((((((((((HootVersion"
   " NATURAL JOIN versioned_channels)"
   " NATURAL JOIN versioned_asics)"
   " NATURAL JOIN versioned_motherboards)"
   " NATURAL JOIN versioned_servicecables)"
   " NATURAL JOIN versioned_servicecards)"
   " NATURAL JOIN versioned_coldcables)"
   " NATURAL JOIN versioned_intermediateamplifiers)"
   " NATURAL JOIN versioned_warmcables)"
   " NATURAL JOIN versioned_adcreceivers)"
   " NATURAL JOIN versioned_fecards)"
   " NATURAL JOIN versioned_crates)"
   " NATURAL JOIN versioned_motherboard_mapping)"
   " NATURAL JOIN versioned_fem_mapping)"
   " NATURAL JOIN versioned_fem_map_ranges)"
   " NATURAL JOIN versioned_fem_crate_ranges)"
   " NATURAL JOIN versioned_fem_slot_ranges)"
   " WHERE version_set = '"
     + version_set
       + "';";
  logInfo << "Trying to select data from sqlite: " << select_cmd;
  rc = sqlite3_prepare_v2(db, select_cmd.c_str(), -1, &statement, &dummy);
  if( rc ){
    logWarn << "Could not prepare select statement on sqlite file " << file << " error: " << sqlite3_errmsg(db);
    sqlite3_finalize(statement);
    sqlite3_close(db);
    return false;
  }
  
  int col_crate       = -1;
  int col_card        = -1;
  int col_channel     = -1;
  int col_larsoft     = -1;
  int col_wireplane   = -1;
  int col_asic_id     = -1;
  int col_servicecard_id=-1;
  int columns = sqlite3_column_count(statement);
  for(int icol=0;icol<columns; icol++) {
    std::string name = (const char*) sqlite3_column_name(statement,icol);
    if(name=="crate_id") { col_crate = icol; continue; }
    if(name=="daq_slot") { col_card = icol; continue; }
    if(name=="fem_channel") { col_channel = icol; continue; }
    if(name=="larsoft_channel") { col_larsoft = icol; continue; }
    if(name=="wireplane") { col_wireplane = icol; continue; }
    if(name=="asic_id") { col_asic_id = icol; continue; }
    if(name=="servicecard_id") { col_servicecard_id = icol; continue; }
    
  }
  
  if(   (col_crate     == -1)
      ||(col_card      == -1)
      ||(col_channel   == -1)
      ||(col_larsoft   == -1)
      ||(col_wireplane == -1)
      ||(col_asic_id == -1)
      ||(col_servicecard_id == -1)
   ) {
      
        logWarn << "Could not find all important column names! ";
        sqlite3_finalize(statement);
        sqlite3_close(db);
        return false;      
      }
  
  int step=0;
  while(true) {
    rc = sqlite3_step(statement);
    if(rc != SQLITE_ROW) break;
    step++;
    
    Plek p;
    for(int j=0;j<columns;j++) {
        if(j==col_crate)               p._crate   = sqlite3_column_int(statement,j);
        else if(j==col_card     )      p._card    = sqlite3_column_int(statement,j);
        else if(j==col_channel  )      p._channel = sqlite3_column_int(statement,j);
        else if(j==col_larsoft  )      p._wirenum = sqlite3_column_int(statement,j);
        else if(j==col_wireplane)      p._view    = sqlite3_column_text(statement,j)[0];
        else if(j==col_asic_id)        p._asic_id = sqlite3_column_int(statement,j);
        else if(j==col_servicecard_id) p._servicecard_id = sqlite3_column_int(statement,j);
        
        else 
          p._info[(const char*) sqlite3_column_name(statement,j)]=(const char*) sqlite3_column_text(statement,j);
    }
    
    fixPlek(p);
    insert(p);  
  }
  logInfo << "Loaded " << step << " TPC pleks from " << source;
    
  if(rc != SQLITE_DONE) {
    logWarn << "Could not retrieve data from " << file << " after " << m_ccc_to_plek.size() <<" rows.  error: " << sqlite3_errmsg(db);
    sqlite3_finalize(statement);
    sqlite3_close(db);
    return false;
  }
  
  sqlite3_finalize(statement);
  rc = sqlite3_close(db);
  if(rc != SQLITE_OK) { 
    logWarn << "sqlite3_close NOT successful.";    
  }else {
    logWarn << "sqlite3_close ok";
  }
  
  return true;
}



bool Plexus::buildPmt(double event_time, double query_time, const std::string& source)
{
  // Interpret source string
  // Is it an sqlite or postgres?
  if(source.length()==0) return false;
  if(source.find("postgres")!=std::string::npos) return buildPmtPostgres(event_time,query_time,source);
  if(source.find("sqlite")  !=std::string::npos) return buildPmtSqlite(event_time,query_time,source);

  logWarn << "Plexus::buildPmt Could not figure out connection string " << source;
  return false;
}


bool Plexus::buildPmtPostgres (double , double , const std::string& )
{
  logWarn << "Plexus::buildPmtPostgres not implemented. Hoot Gibson doesn't support PMT mapping. Blame Jason.";
  return false;
}

bool Plexus::buildPmtSqlite   (double event_time, double , const std::string& source)
{
  std::string file = source.substr(std::string("sqlite ").length()); // Remove leading 'postgres ' statement.

  sqlite3* db;
  sqlite3_stmt *statement;
  const char *dummy;
  int rc;
 
  /// PMT connections database
  rc = sqlite3_open(file.c_str(), &db);
  if( rc ){
    logWarn << "Could not open sqlite file " << file;
    sqlite3_close(db);
    return false;
  }
  
  // Look up the times
  std::string version_query = "select version, start_unix_time, stop_unix_time from pmt_version where start_unix_time <= " + std::to_string(event_time)
    + " and stop_unix_time > " + std::to_string(event_time) + ";";
  rc = sqlite3_prepare_v2(db, version_query.c_str(), -1, &statement, &dummy);
  
  rc = sqlite3_step(statement);
  if(rc != SQLITE_ROW) {
    logWarn << "No validity rows returned on file " << file ;
    logWarn << "Version query: " << version_query;
    sqlite3_finalize(statement);
    // Fallback: use most recent.
    rc = sqlite3_prepare_v2(db, "select version, start_unix_time, stop_unix_time from pmt_version order by start_unix_time desc limit 1;", -1, &statement, &dummy); 
    rc = sqlite3_step(statement);
    if(rc != SQLITE_ROW) {
      sqlite3_finalize(statement);
      sqlite3_close(db);
      return false;
    }
  }
  int version = sqlite3_column_int(statement,0);
  m_validity_start = std::max(sqlite3_column_double(statement,1), m_validity_start);
  m_validity_end   = std::min(sqlite3_column_double(statement,2), m_validity_end);
  
  logInfo << "Found version_set " << version;
  logInfo << "PMT version start  " << sqlite3_column_double(statement,1);
  logInfo << "PMT version stop   " << sqlite3_column_double(statement,2);
  sqlite3_finalize(statement);

  std::string pmtQuery =  "SELECT * FROM pmt_channels where version = " + std::to_string(version) + ";";

  logInfo << "Running PMT select: " << pmtQuery;
  rc = sqlite3_prepare_v2(db, pmtQuery.c_str(), -1, &statement, &dummy);
  if( rc ){
    logWarn << "Could not prepare statement on sqlite file " << file << " error: " << sqlite3_errmsg(db);
    sqlite3_finalize(statement);
    sqlite3_close(db);
    return false;
  }

  // Find columns.
  int col_crate       = -1;
  int col_card        = -1;
  int col_channel     = -1;
  int col_type        = -1;
  int col_pmtid       = -1;
  int col_gain        = -1;
  int col_stream      = -1;
  int columns = sqlite3_column_count(statement);
  for(int icol=0;icol<columns; icol++) {
    std::string name = (const char*) sqlite3_column_name(statement,icol);
    if(name=="crate")     { col_crate = icol; continue; }
    if(name=="card")      { col_card = icol; continue; }
    if(name=="channel")   { col_channel = icol; continue; }
    if(name=="type")      { col_type = icol; continue; }
    if(name=="pmtid")     { col_pmtid = icol; continue; }
    if(name=="gain")      { col_gain = icol; continue; }
    if(name=="stream")    { col_stream = icol; continue; }   
  }
  
  if(   (col_crate       == -1)
      ||(col_card        == -1)
      ||(col_channel     == -1)
      ||(col_type        == -1)
      ||(col_pmtid       == -1)
      ||(col_gain        == -1)
      ||(col_stream      == -1)
   ) {
      
        logWarn << "Could not find all important column names! ";
        sqlite3_finalize(statement);
        sqlite3_close(db);
        return false;      
      }
  
  int step = 0;
  while(true) {
    rc = sqlite3_step(statement);
    if(rc != SQLITE_ROW) break;
    step++;
    Plek p;
    for(int j=0;j<columns;j++) {
        const char* v = (const char*) sqlite3_column_text(statement,j);        
        if(v==0) continue; // Check for null value.
        if(strlen(v)==0) continue; // Check for null value.
        if(j==col_crate)          p._crate   = sqlite3_column_int(statement,j);
        else if(j==col_card     ) p._card    = sqlite3_column_int(statement,j);
        else if(j==col_channel  ) p._channel = sqlite3_column_int(statement,j);
        else if(j==col_type     ) p._type    = v[0];
        else if(j==col_pmtid    ) p._pmt     = sqlite3_column_int(statement,j);
        else if(j==col_gain     ) p._gain    = v[0];
        else if(j==col_stream   ) p._stream  = v;
        else {
          const char* k = (const char*) sqlite3_column_name(statement,j);
          p._info[k]=v;
        }
    }
    
    insert(p);    
  }
  
  logInfo << "Read " << step << " PMT rows from " << source;
  
  if(rc != SQLITE_DONE) {
    logWarn << "Could not retrieve data from " << file << " after " << step << " rows.  error: " << sqlite3_errmsg(db);
    sqlite3_finalize(statement);
    sqlite3_close(db);
    return false;
  }
  
  sqlite3_finalize(statement);
  rc = sqlite3_close(db);
  if(rc != SQLITE_OK) { 
    logWarn << "sqlite3_close NOT successful.";    
  }else {
    logWarn << "sqlite3_close ok";
  }
  return true;
}


int Plexus::ccc(int crate, int card, int channel)
{
  return (100*crate + card)*100 + channel;
}

const Plexus::Plek& Plexus::get(int crate, int card, int channel)
{
  MapType_t::iterator it = m_ccc_to_plek.find(ccc(crate,card,channel));
  if(it!=m_ccc_to_plek.end()) return it->second;
  return m_nullplek;
}

void Plexus::insert(Plek& p)
{
  MapType_t::key_type iccc = ccc(p.crate(),p.card(),p.channel());  
  std::pair<MapType_t::iterator,bool> inserted = m_ccc_to_plek.insert(MapType_t::value_type(iccc,p));
  if(!inserted.second) {
    logError << "Two channels with the same crate/card/channel in the Plexus channel map! ";
    logError << "First: " << m_ccc_to_plek[iccc].to_string();
    logError << "Second:" << p.to_string();
  }
}

void Plexus::fixPlek(Plek& p)
{
  // Fix up a few of the common elements in TPC mapping.
  switch(p._view) {
    case 'U': p._plane = 0; break;
    case 'V': p._plane = 1; break;
    case 'Y': p._plane = 2; break;
    default : p._plane = -1; break;
  }

  if(p._plane==0)        p._planewire = p._wirenum ;
  else if(p._plane==1)   p._planewire = p._wirenum  - 2399;
  else if(p._plane==2)   p._planewire = p._wirenum  - 4798;
}

#include "Plexus_hardcoded.h"




}}}} // namespace
