"""
nflfastR play-by-play preprocessor
Usage: python preprocess.py play_by_play_2025.csv pbp_2025.json
Outputs a drive-structured JSON ready for D3.

example use: py preprocess.py play_by_play_2025.csv pbp_2025.json
"""
import pandas as pd
import json, re, sys

INPUT  = sys.argv[1] if len(sys.argv) > 1 else 'play_by_play_2025.csv'
OUTPUT = sys.argv[2] if len(sys.argv) > 2 else 'pbp_2025.json'

COLS = [
    'play_id','game_id','home_team','away_team','week','season_type',
    'posteam','defteam','drive','fixed_drive','fixed_drive_result',
    'qtr','down','ydstogo','yardline_100','desc','play_type',
    'yards_gained','ep','epa','wp','wpa','score_differential',
    'game_date','passer_player_name','rusher_player_name','receiver_player_name',
    'touchdown','interception','sack','complete_pass','first_down',
    'drive_play_count','drive_ended_with_score',
    'drive_start_yard_line','drive_end_yard_line','drive_first_downs'
]

def safe_int(v):
    if pd.isna(v): return None
    try: return int(v)
    except:
        m = re.search(r'-?\d+', str(v))
        return int(m.group()) if m else None

def safe_float(v, decimals=3):
    if pd.isna(v): return None
    try: return round(float(v), decimals)
    except: return None

print(f"Reading {INPUT}...")
df = pd.read_csv(INPUT, usecols=COLS, low_memory=False)
df = df[df['season_type'] == 'REG']
df = df[df['play_type'].isin(['pass','run','qb_kneel','qb_spike'])]
df = df[df['down'].notna()]

games = df[['game_id','home_team','away_team','week','game_date']].drop_duplicates()

drive_plays = []
for (game_id, drive_num), grp in df.groupby(['game_id','fixed_drive'], sort=False):
    grp = grp.sort_values('play_id')
    if len(grp) < 2:
        continue

    plays = []
    for _, row in grp.iterrows():
        plays.append({
            'play_id':          safe_int(row['play_id']),
            'qtr':              safe_int(row['qtr']),
            'down':             safe_int(row['down']),
            'ydstogo':          safe_int(row['ydstogo']),
            'yardline_100':     safe_int(row['yardline_100']),
            'desc':             str(row['desc']),
            'play_type':        str(row['play_type']),
            'yards_gained':     safe_float(row['yards_gained'], 1) or 0,
            'ep':               safe_float(row['ep']),
            'epa':              safe_float(row['epa']),
            'wp':               safe_float(row['wp']),
            'score_differential': safe_int(row['score_differential']) or 0,
            'touchdown':        safe_int(row['touchdown']) or 0,
            'interception':     safe_int(row['interception']) or 0,
            'sack':             safe_int(row['sack']) or 0,
            'first_down':       safe_int(row['first_down']) or 0,
            'passer':           str(row['passer_player_name']) if pd.notna(row['passer_player_name']) else None,
            'rusher':           str(row['rusher_player_name']) if pd.notna(row['rusher_player_name']) else None,
            'receiver':         str(row['receiver_player_name']) if pd.notna(row['receiver_player_name']) else None,
        })

    game_row = games[games['game_id'] == game_id].iloc[0]
    drive_plays.append({
        'game_id':   game_id,
        'drive':     int(drive_num),
        'week':      int(game_row['week']),
        'home_team': game_row['home_team'],
        'away_team': game_row['away_team'],
        'game_date': game_row['game_date'],
        'posteam':   str(grp['posteam'].iloc[0]),
        'result':    str(grp['fixed_drive_result'].iloc[0]) if pd.notna(grp['fixed_drive_result'].iloc[0]) else 'Unknown',
        'plays':     plays
    })

with open(OUTPUT, 'w') as f:
    json.dump(drive_plays, f)

import os
size = os.path.getsize(OUTPUT)
print(f"Done. {len(drive_plays)} drives → {OUTPUT} ({size/1024/1024:.1f} MB)")